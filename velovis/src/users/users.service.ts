import {
  Inject,
  Injectable,
  forwardRef,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
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
  // AKTİVASYON
  // =================================================================
  async activateUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
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
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  // =================================================================
  // KULLANICI ROLLERİNİ GÜNCELLEME
  // =================================================================
  async updateRoles(userId: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');

    return await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: userId },
      });

      if (roleIds.length > 0) {
        const data = roleIds.map((roleId) => ({
          userId: userId,
          roleId: roleId,
        }));

        await tx.userRole.createMany({
          data: data,
        });
      }

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
