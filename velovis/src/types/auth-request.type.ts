import { Request } from 'express';

export interface AuthUserPayload {
  id: string;
  email: string;
}

export interface RequestWithUser extends Request {
  user: {
    id: string;
    permissions: Set<string>;
  };
}
