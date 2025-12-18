import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service'; // EKLENDİ
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

@Injectable()
export class OrdersService {
  
  // DİKKAT: Artık burada "private iyzipay" yok! 
  // Tüm Iyzico işlemleri PaymentService üzerinden yapılacak.

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService, // PaymentService'i buraya enjekte ettik
  ) {}

  async create(userId: string) {
    return {
      message: 'Sipariş oluşturma işlemi PaymentService üzerinden otomatiktir.',
    };
  }

  // =================================================================
  // 1. SADECE BENİM SİPARİŞLERİM
  // =================================================================
  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, primaryPhotoUrl: true, price: true },
            },
          },
        },
      },
    });
  }

  // =================================================================
  // 2. TÜM SİPARİŞLER (Admin)
  // =================================================================
  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, primaryPhotoUrl: true, price: true },
            },
          },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  // =================================================================
  // 3. TEK SİPARİŞ DETAYI
  // =================================================================
  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, primaryPhotoUrl: true, price: true },
            },
          },
        },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    const canReadAny = user.permissions.has(PERMISSIONS.ORDERS.READ_ANY);

    if (canReadAny) return order;
    if (order.userId !== user.id) throw new ForbiddenException('Yetkiniz yok.');

    return order;
  }

  // =================================================================
  // 4. DURUM GÜNCELLEME
  // =================================================================
  async updateStatus(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    return this.prisma.order.update({
      where: { id: id },
      data: { status: updateOrderDto.status },
      include: { items: true },
    });
  }

  // =================================================================
  // 5. KULLANICI SİPARİŞ İPTALİ (Kargodan önce)
  // =================================================================
  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    if (order.userId !== userId) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }

    if (
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Kargoya verilmiş veya teslim edilmiş sipariş iptal edilemez.',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Sipariş zaten iptal edilmiş.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Stokları Geri Yükle
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId || undefined },
          data: {
            stockQuantity: { increment: item.quantity },
          },
        });
      }

      // Sipariş Durumunu Güncelle
      return await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  // =================================================================
  // 6. ADMIN IYZICO İADE İŞLEMİ (GÜNCELLENDİ)
  // =================================================================
  async refundOrder(orderId: string) {
    // A. Siparişi Bul
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    // B. Kontroller
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Bu sipariş zaten iade edilmiş.');
    }

    if (!order.paymentId) {
      console.error(`❌ HATA: Sipariş ${orderId} için Payment ID yok.`);
      throw new BadRequestException(
        'Bu siparişin Iyzico tarafında bir ödeme kaydı (paymentId) yok. İade yapılamaz.',
      );
    }

    console.log(`🔄 İade İsteği (OrdersService): OrderID=${orderId}, PaymentID=${order.paymentId}`);

    try {
      // C. Iyzico İadesi (ARTIK PAYMENT SERVICE ÜZERİNDEN YAPILIYOR)
      // Bu sayede PaymentService içindeki doğru API anahtarlarını kullanacak.
      const iyzicoResult = await this.paymentService.refundPayment(
        order.paymentId,
        order.totalPrice.toString()
      );

      // D. Veritabanı Güncellemesi (Status + Stok)
      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        // Stokları geri yükle
        for (const item of order.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }

        // Sipariş durumunu güncelle
        return await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.REFUNDED },
        });
      });

      console.log('✅ İade ve DB güncellemesi başarılı.');

      return {
        message: 'İade işlemi başarıyla tamamlandı.',
        iyzicoResult: iyzicoResult,
        order: updatedOrder,
      };

    } catch (error: any) {
      console.error('❌ İade İşlemi Başarısız (OrdersService):', error);
      // Kullanıcıya anlamlı hata dön
      throw new BadRequestException(error.message || 'İade işlemi sırasında bir hata oluştu.');
    }
  }
}