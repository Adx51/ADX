import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Roomy JSON limit so scan endpoints can accept base64 image data URLs
  // (the client resizes photos first, so payloads stay small in practice).
  app.useBodyParser('json', { limit: '12mb' });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`ADX API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
