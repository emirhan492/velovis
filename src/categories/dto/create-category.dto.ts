// src/categories/dto/create-category.dto.ts

import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  order: number;
}
