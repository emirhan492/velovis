import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

const Iyzipay = require('iyzipay');

@Injectable()
export class PaymentService {
  private iyzipay;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Ayarları .env dosyasından çekiyoruz
    this.iyzipay = new Iyzipay({
      apiKey: this.configService.get<string>('IYZICO_API_KEY')!,
      secretKey: this.configService.get<string>('IYZICO_SECRET_KEY')!,
      uri: this.configService.get<string>('IYZICO_BASE_URL'),
    });
  }

  // =================================================================
  // 1. ÖDEME BAŞLATMA
  // =================================================================
  async startPayment(user: any, cartItems: any[], totalPrice: number) {
    console.log(
      `🚀 Ödeme Başlatılıyor... UserID: ${user.id}, Tutar: ${totalPrice}`,
    );

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: user.id,
      price: totalPrice.toString(),
      paidPrice: totalPrice.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: user.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: 'http://localhost:3000/api/payment/callback',
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: user.id,
        name: user.firstName || 'Misafir',
        surname: user.lastName || 'Kullanıcı',
        gsmNumber: '+905350000000',
        email: user.email,
        identityNumber: '11111111111',
        lastLoginDate: '2015-10-05 12:43:35',
        registrationAddress:
          'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
        ip: '85.34.78.112',
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34732',
      },
      shippingAddress: {
        contactName: user.fullName || 'John Doe',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
        zipCode: '34742',
      },
      billingAddress: {
        contactName: user.fullName || 'John Doe',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
        zipCode: '34742',
      },
      basketItems: this.mapCartItemsToIyzipay(cartItems),
    };

    return new Promise((resolve, reject) => {
      this.iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error('Iyzico Başlatma Hatası:', err);
          reject(new InternalServerErrorException(err));
        } else {
          if (result.status === 'failure') {
            console.error('Iyzico Başarısız:', result.errorMessage);
            reject(new InternalServerErrorException(result.errorMessage));
          }
          resolve(result);
        }
      });
    });
  }

  // =================================================================
  // SONUÇ SORGULAMA
  // =================================================================
  async retrievePaymentResult(token: string) {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: '123456789',
      token: token,
    };

    return new Promise((resolve, reject) => {
      this.iyzipay.checkoutForm.retrieve(request, (err, result) => {
        if (err) {
          reject(new InternalServerErrorException(err));
        } else {
          resolve(result);
        }
      });
    });
  }

  // =================================================================
  // SİPARİŞ KAYDI (Transaction) - DÜZELTİLDİ
  // =================================================================
  async processSuccessfulPayment(
    userId: string,
    paidPrice: number,
    paymentId: string,
  ) {
    console.log(
      `📦 Sipariş Oluşturuluyor... UserID: ${userId}, PaymentID: ${paymentId}`,
    );

    return await this.prisma.$transaction(async (tx) => {
      // Sepeti Bul
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        console.error(
          `❌ HATA: Kullanıcının (${userId}) sepeti boş görünüyor!`,
        );
      }

      // Sipariş Oluştur
      const newOrder = await tx.order.create({
        data: {
          userId: userId,
          totalPrice: paidPrice,
          status: 'PAID',
          paymentId: paymentId,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
            })),
          },
        },
      });

      // Stoktan Düş
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
      }

      // Sepeti Temizle
      await tx.cartItem.deleteMany({
        where: { userId },
      });

      return newOrder;
    });
  }

  private mapCartItemsToIyzipay(cartItems: any[]) {
    return cartItems.map((item) => {
      const itemTotalPrice = Number(item.product.price) * item.quantity;
      return {
        id: item.product.id,
        name: item.product.name,
        category1: item.product.category?.name || 'Genel',
        category2: 'Elektronik',
        itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
        price: itemTotalPrice.toFixed(2),
      };
    });
  }

  // ============================
  // Para iade fonksiyonu
  // =============================
  async refundPayment(
    paymentId: string,
    price: string,
    ip: string = '85.34.78.112',
  ) {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: '123456789',
      paymentTransactionId: paymentId,
      price: price,
      currency: Iyzipay.CURRENCY.TRY,
      ip: ip,
    };

    return new Promise((resolve, reject) => {
      this.iyzipay.refund.create(request, (err, result) => {
        if (err) {
          reject(new InternalServerErrorException(err));
        } else {
          if (result.status === 'failure') {
            reject(new InternalServerErrorException(result.errorMessage));
          }
          resolve(result);
        }
      });
    });
  }
}
