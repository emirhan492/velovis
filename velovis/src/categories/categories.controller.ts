// src/categories/categories.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // POST (Oluşturma)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.CATEGORIES.CREATE)
  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  // GET (Listeleme) - Herkese Açık, Guard YOK
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // GET (Detay) - Herkese Açık, Guard YOK
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  // PATCH (Güncelleme)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.CATEGORIES.UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  // DELETE (Silme)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.CATEGORIES.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
