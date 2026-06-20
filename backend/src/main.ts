import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '@/app.module';

async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const access = process.env.JWT_ACCESS_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;
    if (
      !access ||
      !refresh ||
      access.length < 32 ||
      refresh.length < 32 ||
      access === refresh
    ) {
      throw new Error(
        'Production requires distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values of at least 32 characters',
      );
    }
  }
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('TaskBoard API')
    .setDescription('Task Management Dashboard — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
