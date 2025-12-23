import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Yardımcı Sınıf: Tek bir bedenin yapısını tanımlıyoruz
class ProductSizeDto {
  @IsString()
  @IsNotEmpty()
  size: string; // Örn: "S", "M", "42"

  @IsInt()
  @Min(0)
  stock: number; // Örn: 5, 10
}

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

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  // ARTIK stockQuantity YOK. YERİNE SIZES VAR:
  @IsArray()
  @ValidateNested({ each: true }) // Dizinin içindeki her elemanı kontrol et
  @Type(() => ProductSizeDto) // Gelen veriyi ProductSizeDto sınıfına çevir
  sizes: ProductSizeDto[];

  // Ana Fotoğraf URL'si
  @IsString()
  @IsOptional()
  primaryPhotoUrl?: string;

  // Diğer Fotoğraflar (Dizi Halinde)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherPhotos?: string[];
}
