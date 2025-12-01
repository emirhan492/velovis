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

    // Refresh token secret'ı al
    const secret = configService.get('REFRESH_TOKEN_SECRET');

    // Var olup olmadığını kontrol et
    if (!secret) {
      throw new Error(
        'REFRESH_TOKEN_SECRET .env dosyasında tanımlanmamış.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
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
