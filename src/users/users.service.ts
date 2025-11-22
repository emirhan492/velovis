// Dosya: src/users/users.service.ts

// =================================================================
// === BÜTÜN IMPORT'LAR (DOSYANIN EN ÜSTÜ) ===
// =================================================================
import {
  Inject,
  Injectable,
  forwardRef,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client'; // Hata yakalama (P2002) için

// =================================================================
// === CLASS (SINIF) BAŞLANGICI ===
// =================================================================
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  // =================================================================
  // === CREATE (KULLANICI OLUŞTURMA) METODU ===
  // (500 Hatasını çözen düzeltilmiş hali)
  // =================================================================
  async create(data: any) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // 'fullName' alanını oluştur
      const fullName = `${data.firstName} ${data.lastName}`;

      // Orijinal 'password' alanını sil
      delete data.password;

      return await this.prisma.user.create({
        data: {
          ...data, // email, username, firstName, lastName
          fullName: fullName, // 'fullName' eklendi
          hashedPassword: hashedPassword, // Alan adı 'hashedPassword' olarak düzeltildi
        },
      });
    } catch (error) {
      // P2002: Benzersiz alan çakışması hatasını yakala
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Hatanın hangi alandan kaynaklandığını bul
        const target = (error.meta as any)?.target || [];
        if (target.includes('username')) {
          throw new ConflictException('Bu kullanıcı adı zaten alınmış.');
        }
        if (target.includes('email')) {
          throw new ConflictException('Bu e-posta adresi zaten kullanılıyor.');
        }
      }
      // Diğer tüm hataları olduğu gibi fırlat
      throw error;
    }
  }

  // =================================================================
  // === ACTIVATEUSER (YENİ EKLENEN METOD) ===
  // (Bir sonraki adım olan aktivasyon için gerekli)
  // =================================================================
  async activateUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  // =================================================================
  // === DİĞER METODLAR (Alan adları 'hashedPassword'a güncellenmiş) ===
  // =================================================================

  async findAll() {
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
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    });
  }

  async update(id: string, data: any) {
    if (data.password) {
      // Alan adını 'hashedPassword' olarak güncelle
      data.hashedPassword = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    if (data.firstName && data.lastName) {
      data.fullName = `${data.firstName} ${data.lastName}`;
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updatePassword(id: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data: { hashedPassword: hashedPassword }, // Alan adı 'hashedPassword'
    });
  }

  async invalidateAllRefreshTokens(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }
} // <-- CLASS (SINIF) BİTİŞİ
