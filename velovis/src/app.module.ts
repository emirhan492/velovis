import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { ProductPhotosModule } from './product-photos/product-photos.module';
import { CommentsModule } from './comments/comments.module';
import { PrismaModule } from './prisma/prisma.module';
import { CartItemsModule } from './cart-items/cart-items.module';
import { OrdersModule } from './orders/orders.module';
import { RolesModule } from './roles/roles.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    ProductPhotosModule,
    CommentsModule,
    CartItemsModule,
    OrdersModule,
    RolesModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // E-posta gönderim ayarları.
        transport: {
          host: configService.get('MAIL_HOST'),
          port: Number(configService.get('MAIL_PORT')), // String gelirse diye Number'a çevirdik
          secure: false, // 587 veya 2525 portu için FALSE olmalı
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASSWORD'),
          },
          family: 4, // Render'da IPv6 sorununu önlemek için IPv4'e zorluyoruz.
          tls: {
            ciphers: 'SSLv3', // Eski protokol uyumluluğu
            rejectUnauthorized: false, // Sertifika hatalarını (self-signed vs) yok sayar
          },
        },
        defaults: {
          from: `"Velovis Wear" <${configService.get('MAIL_FROM')}>`,
        },
        template: {
          dir: join(__dirname, '..', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
