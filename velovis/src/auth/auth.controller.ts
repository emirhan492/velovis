import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Patch, // Şifre değiştirme için
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Request } from 'express';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // Şifremi unuttum için
import { ResetPasswordDto } from './dto/reset-password.dto'; // Şifre sıfırlama için

// =================================================================
// TİP TANIMLAMALARI
// =================================================================

// 'JwtStrategy'den gelen 'req.user' objesinin tipi
// (Aşama 3'te güncellendi: 'id' ve 'Set<string>' permissions)
interface RequestWithAuthUser extends Request {
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    roles: string[];
    permissions: Set<string>; // Strateji'den 'Set' olarak gelir
  };
}

// 'JwtRefreshStrategy'den gelen 'req.user' objesinin tipi
interface RequestWithRefreshUser extends Request {
  user: {
    sub: string;
    username: string;
    refreshToken?: string;
  };
}

@Controller('auth') // Tüm endpoint'ler /api/auth altında
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =================================================================
  // AŞAMA 1 ENDPOINT'LERİ (TEMEL AUTH)
  // =================================================================
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // GET /me (Aşama 3'te Düzeltildi - Set'i Array'e çevirir)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: RequestWithAuthUser) {
    const user = req.user; // Strateji'den 'user' objesini (içinde 'Set' var) aldık

    // 'Set' objesi JSON'a dönüşmez, bu yüzden 'Array'e dönüştürüp
    // frontend'e öyle yolluyoruz.
    return {
      ...user,
      permissions: Array.from(user.permissions), // Set -> Array
    };
  }

  // =================================================================
  // AŞAMA 2 ENDPOINT'LERİ (TOKEN YÖNETİMİ)
  // =================================================================
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Req() req: RequestWithRefreshUser) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;

    if (!refreshToken) {
      throw new ForbiddenException('Refresh token bulunamadı.');
    }
    return this.authService.refreshToken(userId, refreshToken);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: RequestWithRefreshUser) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;

    if (!refreshToken) {
      throw new ForbiddenException('Refresh token bulunamadı.');
    }
    return this.authService.logout(userId, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() req: RequestWithAuthUser) {
    const userId = req.user.id;
    return this.authService.logoutAll(userId);
  }

  // =================================================================
  // AŞAMA 4 ENDPOINT'LERİ (ŞİFRE YÖNETİMİ)
  // =================================================================

  // Senaryo 1: Hesaptan Şifre Değiştirme
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Req() req: RequestWithAuthUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const userId = req.user.id;
    return this.authService.changePassword(userId, changePasswordDto);
  }

  // Senaryo 2: Şifremi Unuttum (E-posta Gönderme)
  // (Guard YOK - Herkese açık)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  // Senaryo 2: Şifreyi Sıfırlama (Linkten Gelen)
  // (Guard YOK - Herkese açık)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
