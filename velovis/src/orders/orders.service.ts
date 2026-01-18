import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
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

  // =================================================================
  // SİPARİŞ OLUŞTURMA
  // =================================================================
  async create(createOrderDto: CreateOrderDto, userId?: string) {
    const {
      guestName,
      guestEmail,
      guestPhone,
      guestAddress,
      orderItems,
      ...otherData
    } = createOrderDto;

    return this.prisma.order.create({
      data: {
        ...otherData,
        user: userId ? { connect: { id: userId } } : undefined,
        guestName: userId ? undefined : guestName,
        guestEmail: userId ? undefined : guestEmail,
        guestPhone: userId ? undefined : guestPhone,
        guestAddress: userId ? undefined : guestAddress,
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            size: item.size,
          })),
        },
      },
    });
  }

  // =================================================================
  // SADECE BENİM SİPARİŞLERİM
  // =================================================================
  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: {
        userId: userId,
        status: { not: OrderStatus.PENDING },
      },
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
  // TÜM SİPARİŞLER
  // =================================================================
  async findAll() {
    return this.prisma.order.findMany({
      where: {
        status: {
          not: OrderStatus.PENDING,
        },
      },
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
  // TEK SİPARİŞ DETAYI
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
  //  DURUM GÜNCELLEME
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
  // KULLANICI SİPARİŞ İPTALİ
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

      return await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  // =================================================================
  // ADMIN IYZICO İADE İŞLEMİ
  // =================================================================
  async refundOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı.');

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Bu sipariş zaten iade edilmiş.');
    }

    if (!order.paymentId) {
      throw new BadRequestException(
        'Bu siparişin Iyzico tarafında bir ödeme kaydı (paymentId) yok. İade yapılamaz.',
      );
    }

    try {
      const iyzicoResult = await this.paymentService.refundPayment(
        order.paymentId,
        order.totalPrice.toString(),
      );

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
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

  // =================================================================
  //  MİSAFİR SİPARİŞ İPTALİ
  // =================================================================
  async cancelGuestOrder(orderId: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ guestEmail: email }, { user: { email: email } }],
      },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı veya bilgiler eşleşmiyor.');
    }

    if (
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Kargoya verilmiş siparişler iptal edilemez.',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Sipariş zaten iptal edilmiş.');
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Bu sipariş zaten iade edilmiş.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId && item.size) {
          try {
            await tx.productSize.update({
              where: {
                productId_size: { productId: item.productId, size: item.size },
              },
              data: { stock: { increment: item.quantity } },
            });
          } catch (e) {
            console.log(
              'Stok iadesi sırasında varyant bulunamadı, atlanıyor.',
              e,
            );
          }
        }
      }

      return await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }
}