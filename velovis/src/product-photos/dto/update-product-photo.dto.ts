import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProductPhotoDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
