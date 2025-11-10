// src/orders/orders.controller.ts

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

// req.user tipini tanımlıyoruz
interface RequestWithUser extends Request {
  user: {
    id: string;
    permissions: Set<string>;
    // ... (JwtStrategy'den gelen diğer alanlar)
  };
}

@UseGuards(JwtAuthGuard, PermissionsGuard) // Bütün controller'ı koru
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @CheckPermissions(PERMISSIONS.ORDERS.CREATE_OWN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.ordersService.create(userId);
  }

  // 'read:own' VEYA 'read:any'
  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN, PERMISSIONS.ORDERS.READ_ANY)
  @Get()
  findAll(@Req() req: RequestWithUser) {
    const user = req.user;
    // Servis, 'read:any' yetkisi varsa tümünü, yoksa sadece 'own' olanları getirecek
    return this.ordersService.findAll(user);
  }

  // 'read:own' VEYA 'read:any'
  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN, PERMISSIONS.ORDERS.READ_ANY)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    // Servis, 'read:any' yetkisi varsa sahiplik kontrolü yapmayacak
    return this.ordersService.findOne(id, user);
  }

  // Sadece 'update:any' (Admin/Moderatör)
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_ANY)
  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: RequestWithUser,
  ) {
    // Guard zaten 'update:any' yetkisini kontrol etti,
    // Servis artık sahiplik kontrolü yapmamalı.
    return this.ordersService.updateStatus(id, updateOrderDto);
  }
}
