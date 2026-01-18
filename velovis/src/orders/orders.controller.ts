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
  Headers,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { RequestWithUser } from '../types/auth-request.type';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // =================================================================
  // SİPARİŞ OLUŞTURMA
  // =================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('authorization') authHeader?: string,
  ) {
    let userId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = this.jwtService.verify(token);
        userId = decoded.sub || decoded.id;
      } catch (e) {
        console.log('Token geçersiz, misafir işlemi yapılıyor.');
      }
    }

    return this.ordersService.create(createOrderDto, userId);
  }

  // =================================================================
  // MİSAFİR SİPARİŞ SORGULAMA
  // =================================================================
  @Post('track')
  async trackOrder(@Body() body: { orderId: string; email: string }) {
    const { orderId, email } = body;

    if (!orderId || !email) {
      throw new BadRequestException(
        'Lütfen Sipariş Numarası ve E-posta giriniz.',
      );
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ guestEmail: email }, { user: { email: email } }],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                photos: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Sipariş bulunamadı veya bilgiler eşleşmiyor.',
      );
    }

    return order;
  }

  // =================================================================
  // MİSAFİR SİPARİŞ İPTALİ
  // =================================================================
  @Post('guest-cancel')
  async cancelGuestOrder(@Body() body: { orderId: string; email: string }) {
    const { orderId, email } = body;
    if (!orderId || !email) {
      throw new BadRequestException('Sipariş numarası ve e-posta zorunludur.');
    }
    return this.ordersService.cancelGuestOrder(orderId, email);
  }

  // =================================================================
  // KULLANICI SİPARİŞLERİ
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN)
  @Get()
  findMyOrders(@Req() req: RequestWithUser) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  // =================================================================
  // TÜM SİPARİŞLER
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.READ_ANY)
  @Get('admin/all')
  findAll() {
    return this.ordersService.findAll();
  }

  // =================================================================
  // TEK SİPARİŞ DETAYI
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.READ_OWN, PERMISSIONS.ORDERS.READ_ANY)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.ordersService.findOne(id, req.user);
  }

  // =================================================================
  // DURUM GÜNCELLEME
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_ANY)
  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderDto);
  }

  // =================================================================
  // SİPARİŞ İPTALİ
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_OWN)
  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.cancelOrder(id, req.user.id);
  }

  // =================================================================
  // İADE İŞLEMİ
  // =================================================================
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.ORDERS.UPDATE_ANY)
  @Post(':id/refund')
  async refundOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.refundOrder(id);
  }
}