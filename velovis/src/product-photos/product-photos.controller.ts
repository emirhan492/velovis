// src/product-photos/product-photos.controller.ts

import {
  Controller,
  Post,
  Body,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ProductPhotosService } from './product-photos.service';
import { CreateProductPhotoDto } from './dto/create-product-photo.dto';
import { UpdateProductPhotoDto } from './dto/update-product-photo.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard) // Bütün controller'ı koru
@Controller('product-photos')
export class ProductPhotosController {
  constructor(
    private readonly productPhotosService: ProductPhotosService,
  ) {}

  @CheckPermissions(PERMISSIONS.PRODUCT_PHOTOS.CREATE)
  @Post()
  create(@Body() createProductPhotoDto: CreateProductPhotoDto) {
    return this.productPhotosService.create(createProductPhotoDto);
  }

  @CheckPermissions(PERMISSIONS.PRODUCT_PHOTOS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductPhotoDto: UpdateProductPhotoDto,
  ) {
    return this.productPhotosService.update(id, updateProductPhotoDto);
  }

  @CheckPermissions(PERMISSIONS.PRODUCT_PHOTOS.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productPhotosService.remove(id);
  }
}
