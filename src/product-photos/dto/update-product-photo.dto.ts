import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProductPhotoDto {
  @IsNumber()
  @Min(1) // Sıra 1'den başlar
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
