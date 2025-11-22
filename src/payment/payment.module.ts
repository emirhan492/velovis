// src/payment/payment.module.ts

import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { CartItemsModule } from 'src/cart-items/cart-items.module'; // Sepet modülünü import et

@Module({
  imports: [
    ConfigModule, // .env okumak için
    CartItemsModule, // Sepet servisine erişmek için
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
