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

  // Plandaki kural: (İçerik varsa, Başlık zorunludur)
  // Yani, 'content' alanı null veya undefined değilse, 'title' alanı @IsNotEmpty kontrolünden geçmelidir.
  @ValidateIf((o) => o.content !== null && o.content !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'İçerik varsa, başlık zorunlu olmalıdır.' })
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
