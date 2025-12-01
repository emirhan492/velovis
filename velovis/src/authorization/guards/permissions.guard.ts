
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/check-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Decorator'dan endpoint'in hangi yetkileri istediğini al
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Eğer endpoint @CheckPermissions() ile korunmuyorsa, erişime izin ver
    if (!requiredPermissions) {
      return true;
    }

    // req.user objesini al (JwtStrategy'den gelir, JwtAuthGuard'dan sonra çalışmalı)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      throw new ForbiddenException('Yetki bilgisi bulunamadı.');
    }

    // Kullanıcının yetkileri (Set) ile istenen yetkilerin (Array)
    // en az BİRİ eşleşiyor mu?
    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions.has(permission),
    );

    if (hasPermission) {
      return true;
    }

    // Yetkisi yoksa, engelle
    throw new ForbiddenException('Bu işlemi yapmak için yeterli yetkiniz yok.');
  }
}
