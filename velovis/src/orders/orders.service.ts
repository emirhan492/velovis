import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
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
  // 5. KULLANICI SİPARİŞ İPTALİ (Kargodan önce) - GÜNCELLENDİ
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
      // Stokları Geri Yükle (ProductSize Tablosuna)
      for (const item of order.items) {
        if (item.productId && item.size) {
          await tx.productSize.update({
            where: {
              productId_size: {
                productId: item.productId,
                size: item.size,
              },
            },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
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
      throw new BadRequestException(
        'Bu siparişin Iyzico tarafında bir ödeme kaydı (paymentId) yok. İade yapılamaz.',
      );
    }

    try {
      // C. Iyzico İadesi
      const iyzicoResult = await this.paymentService.refundPayment(
        order.paymentId,
        order.totalPrice.toString(),
      );

      // D. Veritabanı Güncellemesi (Status + Stok)
      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        // Stokları geri yükle (ProductSize)
        for (const item of order.items) {
          if (item.productId && item.size) {
            await tx.productSize.update({
              where: {
                productId_size: {
                  productId: item.productId,
                  size: item.size,
                },
              },
              data: {
                stock: { increment: item.quantity },
              },
            });
          }
        }

        // Sipariş durumunu güncelle
        return await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.REFUNDED },
        });
      });

      return {
        message: 'İade işlemi başarıyla tamamlandı.',
        iyzicoResult: iyzicoResult,
        order: updatedOrder,
      };
    } catch (error: any) {
      console.error('❌ İade İşlemi Başarısız:', error);
      throw new BadRequestException(
        error.message || 'İade işlemi sırasında bir hata oluştu.',
      );
    }
  }
}
