
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as crypto from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
    private usersService: UsersService,
  ) {}

  // =================================================================
  // REGISTER (Kayıt Ol)
  // =================================================================
  async register(registerDto: RegisterDto) {
    // E-posta kontrolü
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanılıyor.');
    }

    // Varsayılan 'USER' rolünü bul
    const userRole = await this.prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!userRole) {
      throw new InternalServerErrorException(
        "Sistem hatası: Varsayılan 'USER' rolü bulunamadı.",
      );
    }

    // Şifre Hash'leme
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Kullanıcıyı oluştur
    const newUser = await this.prisma.user.create({
      data: {
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        fullName: `${registerDto.firstName} ${registerDto.lastName}`,
        email: registerDto.email,
        username: registerDto.username || registerDto.email.split('@')[0],
        hashedPassword: hashedPassword,
        isActive: true,

        // Rolü bağlıyoruz
        roles: {
          create: {
            roleId: userRole.id,
          },
        },
      },
    });

    // --- Aktivasyon İşlemleri ---

    const payload = { sub: newUser.id };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACTIVATION_SECRET'),
      expiresIn: '1d',
    });

    const activationUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/activate-account?token=${token}`;

    await this.mailerService.sendMail({
      to: newUser.email,
      subject: 'Velovis Hesap Aktivasyonu',
      html: `
        <p>Merhaba ${newUser.fullName},</p>
        <p>Hesabınızı aktifleştirmek için lütfen aşağıdaki linke tıklayın:</p>
        <p><a href="${activationUrl}" target="_blank">Hesabımı Aktifleştir</a></p>
      `,
    });

    return {
      message:
        'Kayıt başarılı. Hesabınız oluşturuldu ve USER yetkisi tanımlandı.',
    };
  }

  // =================================================================
  // LOGIN (Giriş Yap)
  // =================================================================
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı.');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Hesabınız henüz aktifleştirilmemiş. Lütfen e-postanızı kontrol edin.',
      );
    }

    const isPasswordMatching = await bcrypt.compare(
      password,
      user.hashedPassword,
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı.');
    }

    const tokens = await this.getTokens(user.id, user.username);
    await this.storeRefreshToken(tokens.refreshToken, user.id);
    return tokens;
  }

  // =================================================================
  // HESAP AKTIVASYONU
  // =================================================================
  async activateAccount(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACTIVATION_SECRET'),
      });
      const userId = payload.sub;

      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException('Kullanıcı bulunamadı.');
      }

      if (user.isActive) {
        return { message: 'Hesap zaten aktif.' };
      }

      await this.usersService.activateUser(userId);

      return { message: 'Hesabınız başarıyla aktifleştirildi.' };
    } catch (error) {
      console.error('Aktivasyon Hatası:', error.message);
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş aktivasyon linki.',
      );
    }
  }

  // =================================================================
  // ŞİFRE DEĞİŞTİRME
  // =================================================================
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }

    const isPasswordMatching = await bcrypt.compare(
      currentPassword,
      user.hashedPassword,
    );

    if (!isPasswordMatching) {
      throw new ForbiddenException('Mevcut şifreniz hatalı.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hashedPassword: hashedNewPassword,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: userId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    return {
      message:
        'Şifreniz başarıyla güncellendi. Güvenlik nedeniyle diğer oturumlarınız sonlandırıldı.',
    };
  }

  // =================================================================
  // ŞİFREYİ SIFIRLA
  // =================================================================
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: token },
    });

    if (!resetToken || new Date() > resetToken.expiresAt) {
      if (resetToken) {
        await this.prisma.passwordResetToken.delete({
          where: { id: resetToken.id },
        });
      }
      throw new ForbiddenException(
        'Geçersiz veya süresi dolmuş sıfırlama linki.',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { hashedPassword: hashedNewPassword },
      });
      await tx.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
    });

    return {
      message: 'Şifreniz başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {
        message:
          'Eğer bu e-posta adresi kayıtlıysa, bir sıfırlama linki gönderildi.',
      };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token: token, expiresAt: expiresAt },
    });
    const resetUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/reset-password?token=${token}`;
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Velovis Şifre Sıfırlama Talebi',
      html: `
        <p>Merhaba ${user.fullName},</p>
        <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
        <a href="${resetUrl}" target="_blank">Şifremi Sıfırla</a>
        <p>Bu link 1 saat geçerlidir.</p>
      `,
    });
    return {
      message:
        'Eğer bu e-posta adresi kayıtlıysa, bir sıfırlama linki gönderildi.',
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Erişim reddedildi.');
    const dbToken = await this.findValidRefreshToken(user.id, refreshToken);
    if (!dbToken) {
      throw new ForbiddenException('Erişim reddedildi (Token geçersiz).');
    }
    await this.prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { invalidatedAt: new Date() },
    });
    const newTokens = await this.getTokens(user.id, user.username);
    await this.storeRefreshToken(newTokens.refreshToken, user.id);
    return newTokens;
  }

  async logout(userId: string, refreshToken: string) {
    const dbToken = await this.findValidRefreshToken(userId, refreshToken);
    if (!dbToken) {
      return { message: 'Başarıyla çıkış yapıldı (Token zaten geçersizdi).' };
    }
    await this.prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { invalidatedAt: new Date() },
    });
    return { message: 'Başarıyla çıkış yapıldı.' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId: userId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
    return { message: 'Tüm oturumlardan başarıyla çıkış yapıldı.' };
  }

  // =================================================================
  // YARDIMCI FONKSİYONLAR
  // =================================================================

  private async getTokens(userId: string, username: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, username },
        {
          secret: this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('JWT_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, username },
        {
          secret: this.configService.get('REFRESH_TOKEN_SECRET'),
          expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRATION'),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(token: string, userId: string) {
    const hashedToken = await bcrypt.hash(token, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: userId,
        hashedToken: hashedToken,
      },
    });
  }

  private async findValidRefreshToken(userId: string, token: string) {
    const userTokens = await this.prisma.refreshToken.findMany({
      where: { userId: userId, invalidatedAt: null },
    });
    for (const dbToken of userTokens) {
      const isMatch = await bcrypt.compare(token, dbToken.hashedToken);
      if (isMatch) {
        return dbToken;
      }
    }
    return null;
  }
}
