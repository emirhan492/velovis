import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Bu guard, 'jwt' adını verdiğimiz JwtStrategy'yi otomatik olarak kullanır.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
