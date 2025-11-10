import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as crypto from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  // =================================================================
  // REGISTER (Kayıt Ol)
  // =================================================================
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, username, password, firstName, lastName } = registerDto;
    const fullName = `${firstName} ${lastName}`;

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new ConflictException('Bu e-posta veya kullanıcı adı zaten mevcut.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        fullName,
        username,
        email,
        password: hashedPassword,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
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

    const isPasswordMatching = await bcrypt.compare(password, user.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı.');
    }

    const tokens = await this.getTokens(user.id, user.username);
    await this.storeRefreshToken(tokens.refreshToken, user.id);
    return tokens;
  }

  // =================================================================
  // REFRESH TOKEN (Token Yenile)
  // =================================================================
  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

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

  // =================================================================
  // LOGOUT (Çıkış Yap)
  // =================================================================
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

  // =================================================================
  // LOGOUT ALL (Tüm Oturumlardan Çıkış Yap)
  // =================================================================
  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: userId,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    return { message: 'Tüm oturumlardan başarıyla çıkış yapıldı.' };
  }

  // =================================================================
  // ŞİFRE DEĞİŞTİRME (Change Password)
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
      user.password,
    );

    if (!isPasswordMatching) {
      throw new ForbiddenException('Mevcut şifreniz hatalı.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        userId: userId,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    return { message: 'Şifreniz başarıyla güncellendi. Güvenlik nedeniyle diğer oturumlarınız sonlandırıldı.' };
  }

  // =================================================================
  // ŞİFREMİ UNUTTUM (Forgot Password)
  // =================================================================
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`Şifre sıfırlama denemesi (kullanıcı bulunamadı): ${email}`);
      return { message: 'Eğer bu e-posta adresi kayıtlıysa, bir sıfırlama linki gönderildi.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 saat geçerli

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: token,
        expiresAt: expiresAt,
      },
    });

    const resetUrl = `http://localhost:3001/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Velovis Şifre Sıfırlama Talebi',
      html: `
        <p>Merhaba ${user.fullName},</p>
        <p>Hesabınız için bir şifre sıfırlama talebi aldık.</p>
        <p>Yeni bir şifre belirlemek için lütfen aşağıdaki linke tıklayın:</p>
        <a href="${resetUrl}" target="_blank">Şifremi Sıfırla</a>
        <p>Bu link 1 saat geçerlidir.</p>
      `,
    });

    console.log(`Şifre sıfırlama linki gönderildi: ${email}`);
    return { message: 'Eğer bu e-posta adresi kayıtlıysa, bir sıfırlama linki gönderildi.' };
  }

  // =================================================================
  // ŞİFREYİ SIFIRLA (Reset Password)
  // =================================================================
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: token },
    });

    if (!resetToken) {
      throw new ForbiddenException('Geçersiz veya süresi dolmuş sıfırlama linki.');
    }

    if (new Date() > resetToken.expiresAt) {
      await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      throw new ForbiddenException('Geçersiz veya süresi dolmuş sıfırlama linki.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedNewPassword },
      });
      await tx.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
    });

    return { message: 'Şifreniz başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.' };
  }

  // =================================================================
  // YARDIMCI FONKSİYONLAR (Helpers)
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
      where: {
        userId: userId,
        invalidatedAt: null,
      },
    });

    for (const dbToken of userTokens) {
      const isMatch = await bcrypt.compare(token, dbToken.hashedToken);
      if (isMatch) {
        return dbToken;
      }
    }
    return null;
  }
} // <-- BU, CLASS'IN SON PARANTEZİDİR. TÜM FONKSİYONLAR BUNUN İÇİNDE OLMALI.
