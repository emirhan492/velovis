import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // =================================================================
  // KULLANICILARI LİSTELE (FIND ALL) - GÜNCELLENDİ
  // =================================================================
  async findAll() {
    // Kullanıcıları listelerken, şifrelerini HARİÇ tutmalı
    // ve rollerini DAHİL etmeliyiz.
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        // --- ÇÖZÜM BURADA: Rolleri de dahil et ---
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // --- ÇÖZÜM BİTTİ ---
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // =================================================================
  // KULLANICI SİLME (DELETE) - YENİ
  // =================================================================
  async remove(idToDelete: string, currentUserId: string) {
    // 1. Güvenlik Kuralı: Bir kullanıcı kendini silemez.
    if (idToDelete === currentUserId) {
      throw new ForbiddenException('Kullanıcılar kendi hesaplarını silemez.');
    }

    // 2. Kullanıcıyı bul
    const user = await this.prisma.user.findUnique({ where: { id: idToDelete } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    // 3. Not: `onDelete: Cascade` sayesinde bu kullanıcıya ait
    //    'users_roles', 'cart_items', 'refresh_tokens' vb.
    //    tüm ilişkili veriler de otomatik silinecektir.

    await this.prisma.user.delete({
      where: { id: idToDelete },
    });

    return { message: 'Kullanıcı başarıyla silindi.', deletedUser: user };
  }
  // ================================================================


  // =================================================================
  // TEK KULLANICI GETİR (FIND ONE) - GÜNCELLENDİ
  // =================================================================
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,

        // --- ÇÖZÜM BURADA: Rolleri de dahil et ---
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // --- ÇÖZÜM BİTTİ ---
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return user;
  }
}
