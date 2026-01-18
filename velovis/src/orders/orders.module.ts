import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentModule } from 'src/payment/payment.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PaymentModule, JwtModule.register({})],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
