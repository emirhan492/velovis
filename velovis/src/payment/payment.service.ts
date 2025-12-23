import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
    const apiKey = this.configService.get<string>('IYZICO_API_KEY');
    const secretKey = this.configService.get<string>('IYZICO_SECRET_KEY');
    const baseUrl = this.configService.get<string>('IYZICO_BASE_URL');

    this.iyzipay = new Iyzipay({
      apiKey: apiKey,
      secretKey: secretKey,
      uri: baseUrl,
    });
  }

  // =================================================================
  // 1. ÖDEME BAŞLAT (START PAYMENT)
  // =================================================================
  async startPayment(
    user: any,
    cartItems: any[],
    totalPrice: number,
    addressData: any,
  ) {
    if (!addressData) throw new InternalServerErrorException('Adres yok');

    const fullAddressForIyzico = `${addressData.district} / ${addressData.address}`;

    // Sipariş Kalemlerini Veritabanına Kaydet (PENDING)
    // Not: OrderItem tablosunda 'size' alanı olduğu için burası önemli
    const pendingOrder = await this.prisma.order.create({
      data: {
        userId: user.id,
        totalPrice: totalPrice,
        status: 'PENDING',
        contactName: addressData.contactName,
        city: addressData.city,
        district: addressData.district,
        phone: addressData.phone,
        address: addressData.address,
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
            size: item.size, // <-- KRİTİK: Beden bilgisini OrderItem'a kaydet
          })),
        },
      },
    });

    let gsmNumber = addressData.phone || user.phoneNumber || '+905555555555';
    gsmNumber = gsmNumber.replace(/\s/g, '');
    if (!gsmNumber.startsWith('+')) {
      if (gsmNumber.startsWith('0')) gsmNumber = '+9' + gsmNumber;
      else gsmNumber = '+90' + gsmNumber;
    }

    const apiUrl = this.configService.get<string>('API_URL');
    if (!apiUrl) {
      throw new InternalServerErrorException('API_URL eksik.');
    }

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: pendingOrder.id,
      price: totalPrice.toString(),
      paidPrice: totalPrice.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: pendingOrder.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${apiUrl}/api/payment/callback`,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: String(user.id),
        name: user.firstName || 'Misafir',
        surname: user.lastName || 'Kullanıcı',
        gsmNumber: gsmNumber,
        email: user.email,
        identityNumber: '11111111111',
        lastLoginDate: '2025-01-01 12:00:00',
        registrationAddress: fullAddressForIyzico,
        ip: '85.34.78.112',
        city: addressData.city,
        country: 'Turkey',
        zipCode: '34000',
      },
      shippingAddress: {
        contactName: addressData.contactName,
        city: addressData.city,
        country: 'Turkey',
        address: fullAddressForIyzico,
        zipCode: '34000',
      },
      billingAddress: {
        contactName: addressData.contactName,
        city: addressData.city,
        country: 'Turkey',
        address: fullAddressForIyzico,
        zipCode: '34000',
      },
      basketItems: this.mapCartItemsToIyzipay(cartItems),
    };

    return new Promise((resolve, reject) => {
      this.iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error('Iyzico Hata:', err);
          reject(new InternalServerErrorException(err));
        } else {
          if (result.status === 'failure') {
            console.error('Iyzico Failure:', result.errorMessage);
            reject(new InternalServerErrorException(result.errorMessage));
          }
          resolve(result);
        }
      });
    });
  }

  // =================================================================
  // 2. ÖDEME SONUCU SORGULA
  // =================================================================
  async retrievePaymentResult(token: string) {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: '123456789',
      token: token,
    };
    return new Promise((resolve, reject) => {
      this.iyzipay.checkoutForm.retrieve(request, (err, result) => {
        if (err) reject(new InternalServerErrorException(err));
        else resolve(result);
      });
    });
  }

  // =================================================================
  // 3. SİPARİŞİ TAMAMLA (STOK DÜŞME BURADA) - GÜNCELLENDİ
  // =================================================================
  async completeOrder(orderId: string, paymentId: string) {
    console.log(`✅ Sipariş Onaylanıyor... OrderID: ${orderId}`);

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Sipariş yok');
      if (order.status === 'PAID') return order;

      // 1. Durumu Güncelle
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentId: paymentId },
      });

      // 2. Stokları Düş (ProductSize Tablosundan)
      for (const item of order.items) {
        if (item.productId && item.size) {
          // BEDEN VARSA ProductSize TABLOSUNDAN DÜŞ
          await tx.productSize.update({
            where: {
              productId_size: {
                productId: item.productId,
                size: item.size,
              },
            },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // 3. Sepeti Temizle
      await tx.cartItem.deleteMany({ where: { userId: order.userId } });

      return updatedOrder;
    });
  }

  private mapCartItemsToIyzipay(cartItems: any[]) {
    return cartItems.map((item) => {
      const itemTotalPrice = Number(item.product.price) * item.quantity;
      return {
        id: item.product.id,
        name: `${item.product.name} (${item.size})`, // Iyzico tarafında beden görünsün
        category1: item.product.category?.name || 'Genel',
        category2: 'Giyim',
        itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
        price: itemTotalPrice.toFixed(2),
      };
    });
  }

  // =================================================================
  // 4. PARA İADESİ / İPTALİ (CANCEL)
  // =================================================================
  async refundPayment(
    paymentId: string,
    price: string,
    ip: string = '85.34.78.112',
  ) {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: 'CancelRequest',
      paymentId: paymentId,
      ip: ip,
    };

    return new Promise((resolve, reject) => {
      this.iyzipay.cancel.create(request, (err, result) => {
        if (err || result.status === 'failure') {
          reject(new InternalServerErrorException(result?.errorMessage || err));
        } else {
          resolve(result);
        }
      });
    });
  }
}
