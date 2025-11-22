import {
  IsArray, // <-- Yeni eklendi
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

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  // 👇 YENİ EKLENEN: Ana Fotoğraf URL'si
  @IsString()
  @IsOptional()
  primaryPhotoUrl?: string;

  // 👇 YENİ EKLENEN: Diğer Fotoğraflar (Dizi Halinde)
  @IsOptional()
  @IsArray() // Bunun bir liste (array) olduğunu belirtir
  @IsString({ each: true }) // Listenin içindeki her bir elemanın String olması gerektiğini belirtir
  otherPhotos?: string[];
}