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
        // E-posta gönderim ayarları. Bunları .env dosyasından çekeceğiz.
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get('MAIL_PORT'),
          secure: false,
          requireTLS: true,
          auth: {
            user: configService.get('MAIL_USER'), // E-posta adresi
            pass: configService.get('MAIL_PASSWORD'), // E-posta şifresi
          },
        },
        defaults: {
          from: `"Velovis E-Ticaret" <${configService.get('MAIL_FROM')}>`,
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
