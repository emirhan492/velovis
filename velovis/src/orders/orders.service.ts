// src/orders/orders.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

// req.user objesinin tipini tanımla
type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // ... (create fonksiyonu aynı kalır) ...
  async create(userId: string) {
    // ... (içerik aynı)
  }

  // =================================================================
  // SİPARİŞLERİ LİSTELEME (FIND ALL) - GÜNCELLENDİ
  // =================================================================
  async findAll(user: AuthenticatedUser) {
    const where: Prisma.OrderWhereInput = {};

    // Yetki kontrolü: 'read:any' (tümünü okuma) yetkisi yoksa,
    // sadece 'read:own' (kendininkini okuma) yetkisine bak
    if (!user.permissions.has(PERMISSIONS.ORDERS.READ_ANY)) {
      // Sadece kendi siparişlerini görebilir
      where.userId = user.id;
    }
    // 'read:any' yetkisi varsa, 'where.userId' filtresi uygulanmaz ve tüm siparişler gelir.

    return this.prisma.order.findMany({
      where: where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =================================================================
  // TEK SİPARİŞ DETAYI (FIND ONE) - GÜNCELLENDİ
  // =================================================================
  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, primaryPhotoUrl: true },
            },
          },
        },
        user: {
          select: { fullName: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }

    // YETKİ KONTROLÜ
    const canReadAny = user.permissions.has(PERMISSIONS.ORDERS.READ_ANY);

    if (canReadAny) {
      // Admin/Moderator. Sahiplik kontrolü yapma, siparişi döndür.
      return order;
    }

    // Normal kullanıcı, sahiplik kontrolü yap
    if (order.userId !== user.id) {
      throw new ForbiddenException(
        'Bu siparişi görüntüleme yetkiniz yok.',
      );
    }

    return order;
  }

  // =================================================================
  // SİPARİŞ DURUMU GÜNCELLEME (UPDATE) - GÜNCELLENDİ
  // =================================================================
  async updateStatus(id: string, updateOrderDto: UpdateOrderDto) {
    // Not: Bu fonksiyona gelen isteğin 'UPDATE_ANY' yetkisine
    // sahip olduğu zaten Controller'daki Guard tarafından doğrulandı.
    // Bu yüzden burada EKTSTRA BİR YETKİ/SAHİPLİK kontrolü yapmıyoruz.

    // Sadece siparişin var olup olmadığını kontrol edelim
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }

    return this.prisma.order.update({
      where: { id: id },
      data: {
        status: updateOrderDto.status,
      },
    });
  }
}
