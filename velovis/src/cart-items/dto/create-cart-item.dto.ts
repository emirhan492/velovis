import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateCartItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1) // Sepete en az 1 ürün eklenebilir
  quantity: number;
}
