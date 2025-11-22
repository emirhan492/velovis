import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCommentDto } from './create-comment.dto';

// Update DTO'su, Create DTO'sundan 'productId' alanını çıkarır (OmitType)
// ve kalan tüm alanları opsiyonel (PartialType) yapar.
export class UpdateCommentDto extends PartialType(
  OmitType(CreateCommentDto, ['productId'] as const),
) {}
