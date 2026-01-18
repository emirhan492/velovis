import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // SMTP Bağlantısı
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'), 
      port: this.configService.get<number>('MAIL_PORT'), 
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });


    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP Bağlantı Hatası:', error);
      } else {
        console.log('✅ SMTP Bağlantısı Başarılı (Brevo)');
      }
    });
  }

  // ============================================================
  // AKTİVASYON MAİLİ
  // ============================================================
  async sendUserConfirmation(user: any, token: string) {
    const url = `${this.configService.get('FRONTEND_URL')}/activate-account?token=${token}`;
    
    await this.sendMail({
      to: user.email,
      subject: 'Velovis Hesap Aktivasyonu',
      html: `
        <h3>Hoş geldin ${user.firstName},</h3>
        <p>Hesabını doğrulamak için lütfen aşağıdaki butona tıkla:</p>
        <p>
          <a href="${url}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            HESABIMI DOĞRULA
          </a>
        </p>
        <p>veya linke tıkla: <a href="${url}">${url}</a></p>
      `,
    });
  }

  // ============================================================
  // ŞİFRE SIFIRLAMA MAİLİ
  // ============================================================
  async sendForgotPassword(user: any, token: string) {
    const url = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    await this.sendMail({
      to: user.email,
      subject: 'Velovis Şifre Sıfırlama Talebi',
      html: `
        <h3>Merhaba ${user.fullName},</h3>
        <p>Şifrenizi sıfırlamak için bir talepte bulundunuz.</p>
        <p>Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
        <p>
          <a href="${url}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            ŞİFREMİ SIFIRLA
          </a>
        </p>
        <p>Bu link 1 saat geçerlidir.</p>
      `,
    });
  }

  // ============================================================
  // SİPARİŞ ONAY MAİLİ
  // ============================================================
  async sendOrderConfirmation(
    to: string,
    userName: string,
    orderId: string,
    totalPrice: number,
    items: any[],
  ) {

    const itemsHtml = items
      .map((item) => {
        const productName = item.product?.name || 'Ürün Bilgisi Yüklenemedi';
        const unitPrice = item.unitPrice || item.product?.price || 0;

        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; color: #333;">
               ${productName} ${item.size ? `(${item.size})` : ''}
            </td>
            <td style="padding: 10px; color: #555; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; color: #333; text-align: right; font-family: monospace;">
               ₺${Number(unitPrice).toLocaleString('tr-TR')}
            </td>
        </tr>
      `;
      })
      .join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #000; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">VELOVIS</h1>
        </div>
        <div style="padding: 30px; background-color: #fff;">
          <h2 style="color: #333; margin-top: 0;">Teşekkürler, ${userName}!</h2>
          <p style="color: #666;">Siparişiniz başarıyla alındı ve hazırlanıyor.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #888;">Sipariş Numarası</p>
            <p style="margin: 5px 0 0; font-family: monospace; font-size: 16px; color: #333;">${orderId}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f0f0f0; font-size: 12px; color: #666;">
                <th style="padding: 10px; text-align: left;">Ürün</th>
                <th style="padding: 10px; text-align: center;">Adet</th>
                <th style="padding: 10px; text-align: right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; padding-top: 15px; border-top: 2px solid #000;">
            <span style="font-size: 14px; color: #666; margin-right: 10px;">TOPLAM TUTAR:</span>
            <span style="font-size: 20px; font-weight: bold; color: #000;">₺${Number(totalPrice).toLocaleString('tr-TR')}</span>
          </div>
          <p style="text-align: center; margin-top: 20px;">
            <a href="${this.configService.get('FRONTEND_URL')}/order-tracking" 
               style="color: #666; text-decoration: underline; font-size: 12px;">
               Siparişimi Sorgula
            </a>
          </p>
        </div>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">© 2026 Velovis Wear</p>
        </div>
      </div>
    `;

    await this.sendMail({
      to: to,
      subject: `Siparişiniz Alındı! #${orderId.substring(0, 8)}`,
      html: htmlContent,
    });
  }

  // ============================================================
  // GENEL MAIL GÖNDERME FONKSİYONU
  // ============================================================
  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }) {
    const fromEmail = this.configService.get<string>('MAIL_FROM');

    try {
      await this.transporter.sendMail({
        from: `"Velovis" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      console.log(`📧 Mail gönderildi: ${options.to}`);
    } catch (error) {
      console.error('❌ Mail gönderme hatası:', error);
    }
  }
}