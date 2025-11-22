import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductPhotoDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsNumber()
  @Min(0)
  size: number;

  @IsBoolean()
  @IsOptional() // Opsiyonel: Eğer gönderilmezse servis mantığı karar verecek
  isPrimary?: boolean;
}
