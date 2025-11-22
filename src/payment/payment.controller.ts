// src/payment/payment.controller.ts

import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CartItemsService } from 'src/cart-items/cart-items.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import type { Response } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
  };
}

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly cartItemsService: CartItemsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('start')
  async startPayment(@Req() req: RequestWithUser) {
    const user = req.user;

    const cartItems = await this.cartItemsService.findAll(user.id);

    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Sepetiniz boş, ödeme başlatılamaz.');
    }

    const rawTotalPrice = cartItems.reduce((total, item) => {
      return total + Number(item.product.price) * item.quantity;
    }, 0);

    const totalPrice = parseFloat(rawTotalPrice.toFixed(2));

    const result = await this.paymentService.startPayment(
      user,
      cartItems,
      totalPrice,
    );

    return result;
  }

  @Post('callback')
  async paymentCallback(@Req() req: any, @Res() res: Response) {
    const { token } = req.body;

    // 1. Token kontrolü
    if (!token) {
      console.error('❌ HATA: Iyzico Token göndermedi!');
      return res.redirect('http://localhost:3001/cart?error=token_not_found');
    }

    try {
      // 2. Iyzico'ya soruyoruz
      const result: any =
        await this.paymentService.retrievePaymentResult(token);

      console.log('🔍 IYZICO SONUCU DETAYLARI:');
      console.log('--------------------------------------------------');
      console.log('Status:', result.status);
      console.log('PaymentStatus:', result.paymentStatus);
      console.log('BasketID (UserID):', result.basketId);
      console.log('PaymentID:', result.paymentId); // Bunu loglarda görmek iyi olur
      console.log('--------------------------------------------------');

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        const userId = result.basketId;

        // KRİTİK KONTROL
        if (!userId) {
          console.error('❌ KRİTİK HATA: User ID (basketId) boş geldi!');
          throw new Error('Kullanıcı kimliği doğrulanamadı (basketId eksik).');
        }

        const paidPrice = parseFloat(result.paidPrice);

        // 👇 DÜZELTME BURADA YAPILDI 👇
        // Iyzico'dan gelen 'paymentId'yi servise iletiyoruz.
        const paymentId = result.paymentId;

        // Servise 3 parametre gönderiyoruz:
        await this.paymentService.processSuccessfulPayment(
          userId,
          paidPrice,
          paymentId,
        );
        // 👆 -------------------------- 👆

        console.log(
          `✅ Sipariş Başarıyla Oluşturuldu! UserID: ${userId}, PaymentID: ${paymentId}`,
        );
        return res.redirect('http://localhost:3001/payment/success');
      } else {
        const errorMessage = result.errorMessage || 'Ödeme başarısız oldu.';
        const encodedError = encodeURIComponent(errorMessage);
        return res.redirect(`http://localhost:3001/cart?error=${encodedError}`);
      }
    } catch (error: any) {
      console.error('❌ SİPARİŞ OLUŞTURMA HATASI:', error);
      const encodedError = encodeURIComponent(error.message || 'Sistem Hatası');
      return res.redirect(`http://localhost:3001/cart?error=${encodedError}`);
    }
  }
}
