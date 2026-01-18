import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEmail, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

// Sipariş Kalemleri (Ürünler) için alt şablon
class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsOptional()
  @IsString()
  size?: string;
}

// Ana Sipariş Şablonu
export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  orderItems: CreateOrderItemDto[];

  @IsNumber()
  @IsNotEmpty()
  totalPrice: number;

  // MİSAFİR BİLGİLERİ
  @IsNotEmpty()
  @IsString()
  guestName: string;

  @IsNotEmpty()
  @IsEmail()
  guestEmail: string;

  @IsNotEmpty()
  @IsString()
  guestPhone: string;

  @IsNotEmpty()
  @IsString()
  guestAddress: string;

  @IsOptional()
  @IsString()
  paymentId?: string;
}
