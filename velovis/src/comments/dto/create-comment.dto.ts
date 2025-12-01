import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number; // Değerlendirme (1-5 arası yıldız)


  @ValidateIf((o) => o.content !== null && o.content !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'İçerik varsa, başlık zorunlu olmalıdır.' })
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
