import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateCartItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1) 
  quantity: number;
  size?: string;
}
