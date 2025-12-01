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
  // FİLTRELEME

  @IsUUID()
  @IsOptional()
  category_id?: string;

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
  min_rating?: number;

  // SIRALAMA

  @IsString()
  @IsOptional()
  sort?: string;
}
