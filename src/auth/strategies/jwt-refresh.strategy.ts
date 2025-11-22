import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    // --- HATA ÇÖZÜMÜ BURADA ---

    // 1. Refresh token secret'ı al
    const secret = configService.get('REFRESH_TOKEN_SECRET');

    // 2. Var olup olmadığını kontrol et
    if (!secret) {
      throw new Error(
        'REFRESH_TOKEN_SECRET .env dosyasında tanımlanmamış.',
      );
    }

    // 3. Artık 'secret' değişkeninin string olduğundan eminiz
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret, // Buraya güvenle 'secret' değişkenini veriyoruz
      passReqToCallback: true, // Artık 'secret' string olduğu için bu hata vermeyecek
    });
  }

  // Token geçerliyse bu fonksiyon çalışır
  validate(req: Request, payload: { sub: string; username: string }) {
    const refreshToken = req.body.refreshToken;

    // Controller'a hem kullanıcı bilgilerini (payload) hem de
    // refresh token'ın kendisini döndürüyoruz.
    return {
      ...payload,
      refreshToken,
    };
  }
}
