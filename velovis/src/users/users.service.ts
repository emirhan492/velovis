import {
  Inject,
  Injectable,
  forwardRef,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Path düzeltildi (src/prisma değil ../prisma)
import { AuthService } from '../auth/auth.service'; // Path düzeltildi
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  // =================================================================
  // KULLANICI OLUŞTURMA
  // =================================================================
  async create(data: any) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const fullName = `${data.firstName} ${data.lastName}`;
      delete data.password;

      return await this.prisma.user.create({
        data: {
          ...data,
          fullName: fullName,
          hashedPassword: hashedPassword,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta as any)?.target || [];
        if (target.includes('username')) {
          throw new ConflictException('Bu kullanıcı adı zaten alınmış.');
        }
        if (target.includes('email')) {
          throw new ConflictException('Bu e-posta adresi zaten kullanılıyor.');
        }
      }
      throw error;
    }
  }

  // =================================================================
  // AKTİVASYON (GÜNCELLENDİ: isEmailVerified eklendi)
  // =================================================================
  async activateUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        isEmailVerified: true, // Kritik güncelleme: Mail doğrulandı olarak işaretle
      },
    });
  }

  // =================================================================
  // FIND ALL (TÜM KULLANICILAR - ROLLERİYLE)
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
        isEmailVerified: true, // Bunu da görmek isteyebilirsin
        isActive: true,
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
        createdAt: 'desc',
      },
    });
  }

  // =================================================================
  // FIND ONE (TEK KULLANICI)
  // =================================================================
  async findOne(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    });
  }

  // =================================================================
  // FIND ONE BY EMAIL (AuthService için gerekli olabilir)
  // =================================================================
  async findOneByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
  }

  // =================================================================
  // GÜNCELLEME
  // =================================================================
  async update(id: string, data: any) {
    if (data.password) {
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

  // =================================================================
  // SİLME
  // =================================================================
  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  // =================================================================
  // FIND BY EMAIL / ID
  // =================================================================
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

  // =================================================================
  // ŞİFRE DEĞİŞTİRME
  // =================================================================
  async updatePassword(id: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data: { hashedPassword: hashedPassword },
    });
  }

  // =================================================================
  // REFRESH TOKEN SİLME
  // =================================================================
  async invalidateAllRefreshTokens(userId: string) {
    // Schema'da hashedRefreshToken alanı yoksa bu kısım hata verir.
    // RefreshToken tablosu kullanıyorsan aşağıdaki gibi olmalı:
    return this.prisma.refreshToken.updateMany({
      where: { userId: userId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
  }

  // =================================================================
  // KULLANICI ROLLERİNİ GÜNCELLEME (GÜVENLİ VERSİYON)
  // =================================================================
  async updateRoles(userId: string, roleIdsOrNames: string[]) {
    // Kullanıcıyı bul
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');

    // Gelen veri ID mi yoksa İsim mi (ADMIN, USER)?
    // Genelde frontend'den isim veya ID gelebilir. Biz her ihtimale karşı ID'lerini bulalım.
    // Eğer roleIdsOrNames zaten ID ise bu sorgu boş dönebilir, o yüzden mantığı ID varsayarak kuruyorum.
    // Ancak hata mesajındaki "Unique constraint" hatasını çözmek için en garanti yol SİL-EKLE yöntemidir.

    return await this.prisma.$transaction(async (tx) => {
      // 1. Önce kullanıcının tüm rollerini sil (Temiz sayfa)
      await tx.userRole.deleteMany({
        where: { userId: userId },
      });

      // 2. Eğer eklenecek rol varsa ekle
      if (roleIdsOrNames.length > 0) {
        // Gelen verinin Role ID olduğunu varsayıyoruz (Senin kodunda roleIds demişsin)
        const data = roleIdsOrNames.map((roleId) => ({
          userId: userId,
          roleId: roleId,
        }));

        // createMany kullanmak performanslıdır
        await tx.userRole.createMany({
          data: data,
          skipDuplicates: true, // Çakışma olursa (aynı ID iki kere gelirse) hata verme, atla
        });
      }

      // 3. Güncel kullanıcıyı rolleriyle birlikte döndür
      return tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
    });
  }
}
