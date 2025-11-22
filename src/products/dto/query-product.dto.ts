import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Sıralama yönü (Artan veya Azalan)
enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryProductDto {
  // 1. FİLTRELEME
  
  @IsUUID()
  @IsOptional()
  category_id?: string;

  // Transform, query string'den gelen '100' gibi string değerleri
  // number'a (sayıya) dönüştürür.
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_price?: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  @IsOptional()
  max_price?: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_rating?: number; // Planda "Ortalama puana göre" vardı, bunu ekleyelim (örn: min_rating=4)

  // 2. SIRALAMA (örn: ?sort=price:asc)
  
  @IsString()
  @IsOptional()
  // Sıralama formatını doğrulamak için (örn: "price:asc" veya "createdAt:desc")
  // @Matches(/^(price|rating|createdAt):(asc|desc)$/, {
  //   message: 'Sıralama formatı geçersiz. Örn: price:asc, rating:desc, createdAt:desc'
  // })
  // Not: @Matches karmaşık olabilir, şimdilik serviste ayıracağız.
  sort?: string;
}
