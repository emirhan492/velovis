import {
  Controller,
  Post,
  Req,
  Res,
  Body,
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
    phoneNumber?: string;
  };
}

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly cartItemsService: CartItemsService,
  ) {}

  // =================================================================
  // 1. ÖDEME BAŞLATMA
  // =================================================================
  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  async initialize(
    @Req() req: RequestWithUser,
    @Body() body: { address: any },
  ) {
    const user = req.user;
    const { address } = body;

    if (
      !address ||
      !address.contactName ||
      address.contactName.trim() === '' ||
      !address.city ||
      address.city.trim() === '' ||
      !address.district ||
      address.district.trim() === '' ||
      !address.phone ||
      address.phone.trim() === '' ||
      !address.address ||
      address.address.trim() === ''
    ) {
      throw new BadRequestException(
        'Lütfen tüm adres bilgilerini eksiksiz doldurun.',
      );
    }

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
      address,
    );

    return result;
  }

  // =================================================================
  // 2. CALLBACK (DÜZELTİLDİ)
  // =================================================================
  @Post('callback')
  async paymentCallback(@Req() req: any, @Res() res: Response) {
    const { token } = req.body;

    if (!token) {
      console.error('❌ HATA: Iyzico Token göndermedi!');
      return res.redirect('http://localhost:3001/cart?error=token_not_found');
    }

    try {
      const result: any =
        await this.paymentService.retrievePaymentResult(token);

      console.log('--------------------------------------------------');
      console.log('🔍 IYZICO CALLBACK GELDİ');
      console.log('Status:', result.status);
      console.log('BasketId (Bizim Order ID):', result.basketId); // <-- Doğru ID burada
      console.log('--------------------------------------------------');

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        // 🛑 DÜZELTME BURADA YAPILDI 🛑
        // conversationId yerine basketId kullanıyoruz.
        // Çünkü startPayment metodunda basketId'ye pendingOrder.id'yi atamıştık.
        const orderId = result.basketId;
        const paymentId = result.paymentId;

        if (!orderId) {
          throw new Error('Sipariş ID (basketId) Iyzico yanıtında boş geldi.');
        }

        // Siparişi onayla
        await this.paymentService.completeOrder(orderId, paymentId);

        console.log(`✅ İŞLEM BAŞARILI: Sipariş (${orderId}) onaylandı.`);
        return res.redirect('http://localhost:3001/payment/success');
      } else {
        const errorMessage = result.errorMessage || 'Ödeme başarısız oldu.';
        console.error('❌ IYZICO HATASI:', errorMessage);
        return res.redirect(
          `http://localhost:3001/cart?error=${encodeURIComponent(errorMessage)}`,
        );
      }
    } catch (error: any) {
      console.error('❌ CALLBACK HATASI (SİSTEM):', error.message);
      return res.redirect(
        `http://localhost:3001/cart?error=${encodeURIComponent(error.message)}`,
      );
    }
  }
}
