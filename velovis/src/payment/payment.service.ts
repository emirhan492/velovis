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

    // Başlangıçta ayarları kontrol edelim
    console.log('--- IYZICO CONFIG KONTROL ---');
    console.log('URL:', baseUrl);
    console.log('API Key Var mı?:', apiKey ? 'EVET' : 'HAYIR');
    console.log('Secret Key Var mı?:', secretKey ? 'EVET' : 'HAYIR');
    console.log('-----------------------------');

    this.iyzipay = new Iyzipay({
      apiKey: apiKey,
      secretKey: secretKey,
      uri: baseUrl,
    });
  }

  // ... startPayment ve retrievePaymentResult fonksiyonları aynen kalacak ...
  // (Burayı kısaltıyorum, mevcut kodunuzdaki gibi kalabilir, sadece constructor ve refundPayment değişti)
  async startPayment(
    user: any,
    cartItems: any[],
    totalPrice: number,
    addressData: any,
  ) {
    // ... Mevcut startPayment kodunuz ...
    // (Burayı kopyalayıp yapıştırırken mevcut kodunuzu koruyun)
    // Önceki cevaptaki düzeltilmiş halini kullanın.
    if (!addressData) throw new InternalServerErrorException('Adres yok');

    const fullAddressForIyzico = `${addressData.district} / ${addressData.address}`;

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

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: pendingOrder.id,
      price: totalPrice.toString(),
      paidPrice: totalPrice.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: pendingOrder.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${this.configService.get<string>('API_URL') || 'http://localhost:3000'}/api/payment/callback`,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: String(user.id),
        name:
          user.firstName || addressData.contactName.split(' ')[0] || 'Misafir',
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

  async retrievePaymentResult(token: string) {
    // ... Mevcut retrievePaymentResult kodunuz ...
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

  async completeOrder(orderId: string, paymentId: string) {
    // ... Mevcut completeOrder kodunuz ...
    console.log(`✅ Sipariş Onaylanıyor... OrderID: ${orderId}`);
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Sipariş yok');
      if (order.status === 'PAID') return order;
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentId: paymentId },
      });
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
      }
      await tx.cartItem.deleteMany({ where: { userId: order.userId } });
      return updatedOrder;
    });
  }

  private mapCartItemsToIyzipay(cartItems: any[]) {
    // ... Mevcut helper kodunuz ...
    return cartItems.map((item) => {
      const itemTotalPrice = Number(item.product.price) * item.quantity;
      return {
        id: item.product.id,
        name: item.product.name,
        category1: item.product.category?.name || 'Genel',
        category2: 'Giyim',
        itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
        price: itemTotalPrice.toFixed(2),
      };
    });
  }

  // =================================================================
  // 4. PARA İADESİ / İPTALİ (CANCEL) - DÜZELTİLMİŞ HALİ
  // =================================================================
  async refundPayment(
    paymentId: string,
    price: string,
    ip: string = '85.34.78.112',
  ) {
    console.log('🔄 SİPARİŞ İPTALİ/İADESİ BAŞLATILIYOR...');
    console.log('Payment ID (Main):', paymentId);

    // API KEY Kontrolü
    const currentApiKey = this.configService.get<string>('IYZICO_API_KEY');
    if (!currentApiKey) {
      throw new InternalServerErrorException('Iyzico API Key eksik');
    }

    // 🛑 DÜZELTME: 'refund' yerine 'cancel' kullanıyoruz.
    // Çünkü elimizde sadece ana 'paymentId' var.
    // 'refund' metodu 'paymentTransactionId' (ürün ID'si) ister, bizde o kayıtlı değil.
    // 'cancel' metodu ise tüm sepeti iptal eder ve para iadesi yapar.

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: 'CancelRequest',
      paymentId: paymentId, // Refund'da 'paymentTransactionId' idi, Cancel'da 'paymentId' olur.
      ip: ip,
    };

    return new Promise((resolve, reject) => {
      // DİKKAT: iyzipay.refund yerine iyzipay.cancel kullanıyoruz
      this.iyzipay.cancel.create(request, (err, result) => {
        if (err) {
          console.error('❌ Iyzico Kütüphane Hatası:', err);
          reject(new InternalServerErrorException(err));
        } else {
          console.log('ℹ️ Iyzico Cevabı:', result.status);

          if (result.status === 'failure') {
            console.error('❌ Iyzico Başarısız:', result.errorMessage);
            reject(new InternalServerErrorException(result.errorMessage));
          } else {
            console.log('✅ Sipariş İptali/İadesi Başarılı!');
            resolve(result);
          }
        }
      });
    });
  }
}
