import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  shortDescription: string;

  @IsString()
  @IsNotEmpty()
  longDescription: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsUUID() // Kategori ID'sinin bir UUID olması zorunlu
  @IsNotEmpty()
  categoryId: string;

  @IsInt()
  @Min(0)
  @IsOptional()  // Opsiyonel (eğer gönderilmezse schema'daki default(0) çalışır)
  stockQuantity?: number;
}
