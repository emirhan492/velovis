import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1) // Miktar en az 1 olmalı
  quantity: number;
}
