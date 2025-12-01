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
  Patch,
  Query,
  Res,
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
import { type Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/authorization/decorators/check-permissions.decorator';

// =================================================================
// TİP TANIMLAMALARI
// =================================================================

interface RequestWithAuthUser extends Request {
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    roles: string[];
    permissions: Set<string>;
  };
}

interface RequestWithRefreshUser extends Request {
  user: {
    sub: string;
    username: string;
    refreshToken?: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  // =================================================================
  // TEMEL AUTH
  // =================================================================
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: RequestWithAuthUser) {
    const user = req.user;

    return {
      ...user,
      permissions: Array.from(user.permissions),
    };
  }

  // =================================================================
  // TOKEN YÖNETİMİ
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
  // ŞİFRE YÖNETİMİ
  // =================================================================

  // Hesaptan Şifre Değiştirme
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

  //Şifremi Unuttum
  // (Guard YOK - Herkese açık)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  // Şifreyi Sıfırlama (Linkten Gelen)
  // (Guard YOK - Herkese açık)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // =================================================================
  // HESAP AKTIVASYON (Linkten Gelen)
  // =================================================================

  @Public() // Herkesin erişebilmesi gerekir
  @Get('activate') // HTTP GET isteği
  @HttpCode(HttpStatus.OK)
  async activateAccount(
    @Query('token') token: string, // URL'den token'ı al

  ) {
    // Servisi çağır
    await this.authService.activateAccount(token);


    return {
      success: true,
      message: 'Hesap başarıyla aktifleştirildi.',
    };


  }
}
