// src/authorization/decorators/check-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Decorator'ımız: @CheckPermissions('products:create', 'products:update')
export const CheckPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
