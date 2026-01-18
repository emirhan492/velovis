import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

const Iyzipay = require('iyzipay');

@Injectable()
export class PaymentService {
  private iyzipay;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private mailService: MailService,
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
  // ÖDEME BAŞLAT
  // =================================================================
  async startPayment(
    user: any,
    cartItems: any[],
    price: number,
    addressData: any,
  ) {
    if (!addressData) throw new InternalServerErrorException('Adres bilgisi eksik');

    const fullAddressForIyzico = `${addressData.address} ${addressData.district}/${addressData.city}`;

    const basketItems = cartItems.map((item) => {
        const itemTotal = Number(item.product.price) * item.quantity;
        return {
            id: String(item.product.id),
            name: `${item.product.name} (${item.size})`.substring(0, 49),
            category1: 'Giyim',
            category2: 'Aksesuar',
            itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
            price: itemTotal.toFixed(2)
        };
    });

    const calculatedTotal = basketItems.reduce((acc, item) => acc + Number(item.price), 0);
    const paidPriceStr = calculatedTotal.toFixed(2);

    const pendingOrder = await this.prisma.order.create({
      data: {
        user: user ? { connect: { id: user.id } } : undefined,
        guestName: user ? undefined : addressData.contactName,
        guestEmail: user ? undefined : addressData.email,
        guestPhone: user ? undefined : addressData.phone,
        guestAddress: user ? undefined : fullAddressForIyzico,
        
        totalPrice: Number(paidPriceStr),
        status: 'PENDING',
        
        contactName: addressData.contactName,
        city: addressData.city,
        district: addressData.district,
        phone: addressData.phone,
        address: addressData.address,
        items: {
          create: cartItems.map((item) => {

            const realProductId = item.productId || item.product?.id;

            if (!realProductId) {
                console.error("❌ HATA: Ürün ID'si bulunamadı!", item);
                throw new InternalServerErrorException("Sipariş oluşturulurken ürün ID hatası.");
            }

            return {
              productId: realProductId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              size: item.size,
            };
          }),
        },
      },
    });

    let gsmNumber = addressData.phone || user?.phoneNumber || '+905555555555';
    gsmNumber = gsmNumber.replace(/\s/g, '');
    if (gsmNumber.length > 9 && !gsmNumber.startsWith('+')) {
       gsmNumber = '+90' + gsmNumber.replace(/^0/, '');
    }

    const apiUrl = this.configService.get<string>('API_URL');
    if (!apiUrl) throw new InternalServerErrorException('API_URL eksik.');

    const contactName = addressData.contactName || 'Misafir Kullanıcı';
    const lastSpaceIndex = contactName.lastIndexOf(' ');
    const buyerName = lastSpaceIndex > -1 ? contactName.substring(0, lastSpaceIndex) : contactName;
    const buyerSurname = lastSpaceIndex > -1 ? contactName.substring(lastSpaceIndex + 1) : 'Kullanıcı';

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: pendingOrder.id,
      price: paidPriceStr,
      paidPrice: paidPriceStr,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: pendingOrder.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${apiUrl}/api/payment/callback`,
      enabledInstallments: [1, 2, 3, 6, 9],
      
      buyer: {
        id: user?.id ? String(user.id) : `GUEST_${pendingOrder.id}`,
        name: buyerName,
        surname: buyerSurname,
        gsmNumber: gsmNumber,
        email: user?.email || addressData.email || 'guest@velovis.com',
        
        identityNumber: '11111111111', 
        ip: '85.85.85.85',
        
        lastLoginDate: '2024-01-01 12:00:00',
        registrationDate: '2024-01-01 12:00:00',
        registrationAddress: fullAddressForIyzico,
        city: addressData.city,
        country: 'Turkey',
        zipCode: '34732',
      },
      shippingAddress: {
        contactName: addressData.contactName,
        city: addressData.city,
        country: 'Turkey',
        address: fullAddressForIyzico,
        zipCode: '34742',
      },
      billingAddress: {
        contactName: addressData.contactName,
        city: addressData.city,
        country: 'Turkey',
        address: fullAddressForIyzico,
        zipCode: '34742',
      },
      basketItems: basketItems,
    };

    console.log(`📤 Iyzico Sandbox İsteği: ID=${pendingOrder.id}, Tutar=${paidPriceStr}`);

    return new Promise((resolve, reject) => {
      this.iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error('Iyzico Init Error:', err);
          reject(new InternalServerErrorException(err));
        } else {
          if (result.status === 'failure') {
            console.error('Iyzico Init Failure:', result.errorMessage);
            reject(new InternalServerErrorException(result.errorMessage));
          }
          resolve(result);
        }
      });
    });
  }

  // =================================================================
  // ÖDEME SONUCU SORGULA
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
  // SİPARİŞİ TAMAMLA
  // =================================================================
  async completeOrder(orderId: string, paymentId: string) {
    console.log(`✅ Sipariş Onaylanıyor... OrderID: ${orderId}`);

    const orderDetails = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { 
            items: { include: { product: true } }, 
            user: true
        }
    });

    if (!orderDetails) throw new NotFoundException('Sipariş bulunamadı');
    
    if (orderDetails.items.length > 0) {
    }

    if (orderDetails.status === 'PAID') return orderDetails;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentId: paymentId },
      });

      for (const item of orderDetails.items) {
        if (item.productId && item.size) {
          try {
            await tx.productSize.update({
                where: {
                  productId_size: {
                      productId: item.productId,
                      size: item.size,
                  },
                },
                data: { stock: { decrement: item.quantity } },
            });
          } catch(e) {
              console.warn(`Stok hatası: ${item.productId}`);
          }
        }
      }

      if (orderDetails.userId) {
        await tx.cartItem.deleteMany({ where: { userId: orderDetails.userId } });
      }

      return order;
    });

    try {
        const recipientEmail = orderDetails.user?.email || orderDetails.guestEmail;
        const recipientName = orderDetails.contactName || orderDetails.user?.fullName || 'Değerli Müşterimiz';

        if (recipientEmail) {
            console.log(`📧 Mail atılıyor: ${recipientEmail}`);
            this.mailService.sendOrderConfirmation(
                recipientEmail,
                recipientName,
                orderId,
                Number(orderDetails.totalPrice),
                orderDetails.items
            ).catch(err => console.error("Mail gönderilemedi (Arkaplan):", err));
        }
    } catch (mailError) {
        console.error("Mail hatası:", mailError);
    }

    return updatedOrder;
  }

  // =================================================================
  //  PARA İADESİ
  // =================================================================
  async refundPayment(paymentId: string, price: string, ip: string = '85.34.78.112') {
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