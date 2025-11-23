// Dosya Yolu: velovis/src/types/auth-request.type.ts

import { Request } from 'express';

// JWT Payload'umuzun tipi
// (Prisma'nın 'User' tipiyle çakışmasın diye adı farklı)
export interface AuthUserPayload {
  id: string;
  email: string;
}

// Express Request'ini bu payload ile genişleten yeni tipimiz
export interface RequestWithUser extends Request {
  user: {
    id: string;
    permissions: Set<string>;
  };
}
