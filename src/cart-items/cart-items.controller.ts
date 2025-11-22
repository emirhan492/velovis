// src/cart-items/cart-items.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartItemsService } from './cart-items.service';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { Request } from 'express';
import type { RequestWithUser } from '../types/auth-request.type';

// req.user tipini tanımlıyoruz

@UseGuards(JwtAuthGuard, PermissionsGuard) // Bütün controller'ı koru
@Controller('cart-items')
export class CartItemsController {
  constructor(private readonly cartItemsService: CartItemsService) {}

  @CheckPermissions(PERMISSIONS.CARTS.UPDATE_OWN) // Sepete ekleme = sepeti güncelleme
  @Post()
  addOrUpdateItem(
    @Body() createCartItemDto: CreateCartItemDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.cartItemsService.addOrUpdateItem(userId, createCartItemDto);
  }

  @CheckPermissions(PERMISSIONS.CARTS.READ_OWN)
  @Get()
  findAll(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.cartItemsService.findAll(userId);
  }

  @CheckPermissions(PERMISSIONS.CARTS.UPDATE_OWN)
  @Patch(':id')
  updateQuantity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.cartItemsService.updateQuantity(id, updateCartItemDto, userId);
  }

  @CheckPermissions(PERMISSIONS.CARTS.UPDATE_OWN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.cartItemsService.remove(id, userId);
  }

  @CheckPermissions(PERMISSIONS.CARTS.UPDATE_OWN)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCart(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.cartItemsService.clearCart(userId);
  }
}
