import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Bu guard, adını 'jwt-refresh' verdiğimiz stratejiyi kullanır.
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
