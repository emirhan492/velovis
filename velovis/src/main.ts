import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3001',
      'https://velovis-frontend.vercel.app',
      'https://veloviswear.com',
      'https://www.veloviswear.com',
    ],

    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}

bootstrap().catch((err) => {
  console.error('Uygulama başlatılırken hata oluştu:', err);
});
