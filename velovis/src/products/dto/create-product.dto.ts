import {
  IsArray,
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
