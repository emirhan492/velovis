import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { Request } from 'express';
import type { RequestWithUser } from '../types/auth-request.type';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @CheckPermissions(PERMISSIONS.ORDERS.CREATE_OWN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: RequestWithUser) {
    return this.ordersService.create(req.user.id);
  }

  // 1. KULLANICI SİPARİŞLERİ (Siparişlerim Sayfası İçin)
  // DÜZELTME: Sadece 'READ_OWN' izni istiyoruz.
  // Böylece Admin bile olsa bu endpoint'ten sadece KENDİ siparişlerini çekecek.
  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN)
  @Get()
  findMyOrders(@Req() req: RequestWithUser) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  // 2. TÜM SİPARİŞLER (Admin Paneli İçin)
  // Buraya sadece Admin (READ_ANY yetkisi olan) erişebilir.
  @CheckPermissions(PERMISSIONS.ORDERS.READ_ANY)
  @Get('admin/all')
  findAll() {
    return this.ordersService.findAll();
  }

  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN, PERMISSIONS.ORDERS.READ_ANY)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.ordersService.findOne(id, req.user);
  }

  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_ANY)
  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderDto);
  }

  // KULLANICI: Sipariş İptali
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_OWN) // Kendi siparişini güncelleme yetkisini kullanabiliriz
  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.cancelOrder(id, req.user.id);
  }

  // KULLANICI: iade 
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_ANY) // Sadece Admin yetkisi
  @Post(':id/refund')
  async refundOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.refundOrder(id);
  }
}
