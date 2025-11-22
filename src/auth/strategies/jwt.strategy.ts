import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET .env dosyasında tanımlanmamış.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; username: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true, // <-- 1. ÇÖZÜM: 'email' alanı buraya eklendi
        roles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı veya yetkisiz erişim.');
    }

    const allPermissions = user.roles
      .flatMap((userRole) => userRole.role.permissions)
      .map((perm) => perm.permissionKey);

    const permissionsSet = new Set(allPermissions);

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email, // <-- 2. ÇÖZÜM: 'email' alanı buraya da eklendi
      roles: user.roles.map((r) => r.role.name), 
      permissions: permissionsSet, // 'Set' olarak kalmalı (PermissionsGuard için)
    };
  }
}
