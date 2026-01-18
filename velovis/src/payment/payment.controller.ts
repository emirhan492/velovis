import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // =================================================================
  // 1. ÖDEME BAŞLATMA
  // =================================================================
  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initialize(
    @Body() body: any,
    @Headers('authorization') authHeader?: string,
  ) {
    const { items, address, price } = body;

    let user: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = this.jwtService.decode(token) as any;

        if (decoded) {
          user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            firstName: decoded.firstName || '',
            lastName: decoded.lastName || '',
            phoneNumber: decoded.phoneNumber || '',
          };
        }
      } catch (e) {
        console.log('Token geçersiz veya okunamadı, misafir işlemi yapılıyor.');
      }
    }

    // ---  ADRES DOĞRULAMA ---
    if (
      !address ||
      !address.contactName?.trim() ||
      !address.city?.trim() ||
      !address.district?.trim() ||
      !address.phone?.trim() ||
      !address.address?.trim()
    ) {
      throw new BadRequestException(
        'Lütfen tüm adres bilgilerini eksiksiz doldurun.',
      );
    }

    // --- SEPET KONTROLÜ ---
    if (!items || items.length === 0) {
      throw new BadRequestException('Sepetiniz boş, ödeme başlatılamaz.');
    }

    // --- SERVİSE GÖNDER ---
    const result = await this.paymentService.startPayment(
      user,
      items,
      price,
      address,
    );

    return result;
  }

  // =================================================================
  // CALLBACK (IYZICO'DAN GELEN YANIT)
  // =================================================================
  @Post('callback')
  async paymentCallback(@Body() body: any, @Res() res: Response) {
    const { token } = body;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      console.error(
        '❌ CRITICAL ERROR: FRONTEND_URL .env dosyasında bulunamadı!',
      );
      return res.status(500).send('Configuration Error: FRONTEND_URL missing');
    }

    if (!token) {
      console.error('❌ HATA: Iyzico Token göndermedi!');
      return res.redirect(`${frontendUrl}/cart?error=token_not_found`);
    }

    try {
      const result: any = await this.paymentService.retrievePaymentResult(token);

      console.log('--------------------------------------------------');
      console.log('🔍 IYZICO YANITI DETAYI:');
      console.log('Status:', result.status);
      console.log('PaymentStatus:', result.paymentStatus);
      console.log('ErrorMessage:', result.errorMessage); // <-- Hatayı burada göreceğiz
      console.log('BasketId:', result.basketId);
      console.log('--------------------------------------------------');

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        const orderId = result.basketId;
        const paymentId = result.paymentId;

        if (!orderId) {
          throw new Error('Sipariş ID (basketId) Iyzico yanıtında boş geldi.');
        }

        await this.paymentService.completeOrder(orderId, paymentId);

        console.log(`✅ İŞLEM BAŞARILI: Sipariş (${orderId}) onaylandı.`);
        
        return res.redirect(`${frontendUrl}/payment/success`);
      } else {
        const errorMessage = result.errorMessage || 'Ödeme başarısız oldu.';
        console.error('❌ IYZICO HATASI:', errorMessage);
        return res.redirect(
          `${frontendUrl}/cart?error=${encodeURIComponent(errorMessage)}`,
        );
      }
    } catch (error: any) {
      console.error('❌ CALLBACK HATASI (SİSTEM):', error.message);
      return res.redirect(
        `${frontendUrl}/cart?error=${encodeURIComponent(error.message)}`,
      );
    }
  }
}