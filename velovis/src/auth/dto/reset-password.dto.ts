// Dosya Yolu: velovis/src/auth/dto/reset-password.dto.ts

import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.',
  })
  newPassword: string;
}
