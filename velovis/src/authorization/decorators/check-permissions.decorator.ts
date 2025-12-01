
import { SetMetadata } from '@nestjs/common';
import e from 'express';

export const PERMISSIONS_KEY = 'permissions';

export const CheckPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const Public = () => SetMetadata(PERMISSIONS_KEY, ['*']);
