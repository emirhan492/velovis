// src/payment/payment.module.ts

import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { CartItemsModule } from 'src/cart-items/cart-items.module';

@Module({
  imports: [
    ConfigModule, 
    CartItemsModule, //
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
