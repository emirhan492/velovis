import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
