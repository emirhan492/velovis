import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma, OrderStatus } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import Iyzipay from 'iyzipay';

type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

@Injectable()
export class OrdersService {
  private iyzipay: any;

  constructor(private prisma: PrismaService) {
    // Iyzico Yapılandırması
    this.iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY!,
      secretKey: process.env.IYZICO_SECRET_KEY!,
      uri: 'https://sandbox-api.iyzipay.com', // Canlıya geçerken burası değişmeli
    });
  }

  async create(userId: string) {
    return {
      message: 'Sipariş oluşturma işlemi PaymentService üzerinden otomatiktir.',
    };
  }

  // SADECE BENİM SİPARİŞLERİM (Herkes İçin)
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

  // TÜM SİPARİŞLER (Sadece Admin İçin)
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

  // TEK SİPARİŞ DETAYI
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

  // DURUM GÜNCELLEME
  async updateStatus(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    return this.prisma.order.update({
      where: { id: id },
      data: { status: updateOrderDto.status },
      include: { items: true },
    });
  }

  // KULLANICI SİPARİŞ İPTALİ (Kargodan önce)
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

  // ADMIN IYZICO İADE İŞLEMİ
  async refundOrder(orderId: string) {
    // Siparişi Bul
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    // Kontroller
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Bu sipariş zaten iade edilmiş.');
    }

    // Seed verilerinde paymentId olmayabilir, kontrol ediyoruz
    if (!order.paymentId) {
      throw new BadRequestException(
        'Bu siparişin Iyzico tarafında bir ödeme kaydı (paymentId) yok. İade yapılamaz.',
      );
    }

    // Iyzico İstek Nesnesi
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: order.id,
      paymentId: order.paymentId,
      price: order.totalPrice.toString(),
      ip: '85.34.78.112',
      currency: Iyzipay.CURRENCY.TRY,
    };

    // Iyzico API Çağrısı
    return new Promise((resolve, reject) => {
      this.iyzipay.cancel.create(request, async (err, result) => {
        if (err) {
          return reject(
            new InternalServerErrorException('Iyzico bağlantı hatası: ' + err),
          );
        }

        if (result.status === 'success') {
          // --- BAŞARILI İADE ---

          // Transaction ile Stok ve Durum Güncelle
          try {
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

            resolve({
              message: 'İade işlemi başarıyla tamamlandı.',
              iyzicoResult: result,
              order: updatedOrder,
            });
          } catch (dbError) {
            // Iyzico'da iade oldu ama DB'de hata olduysa kritik bir durumdur
            // Loglanmalı
            reject(
              new InternalServerErrorException('Veritabanı güncelleme hatası'),
            );
          }
        } else {
          // --- IYZICO HATASI ---
          reject(
            new BadRequestException('İade başarısız: ' + result.errorMessage),
          );
        }
      });
    });
  }
}
