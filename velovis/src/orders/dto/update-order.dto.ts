import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @IsEnum(OrderStatus) // Değerin PENDING, PAID, SHIPPED vb. olmasını zorunlu kılar
  status: OrderStatus;
}
