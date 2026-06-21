import 'module-alias/register';
import * as Sentry from '@sentry/node';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { SentryExceptionFilter } from '@/common/sentry/sentry.filter';
import helmet from 'helmet';
import { json, NextFunction, Request, Response, urlencoded } from 'express';

async function bootstrap(): Promise<void> {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
  }
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
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: false, limit: '1mb' }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      process.env.MAINTENANCE_MODE === 'true' &&
      !request.path.includes('/health/')
    ) {
      response.status(503).json({
        success: false,
        message:
          process.env.MAINTENANCE_MESSAGE ?? 'Service temporarily unavailable',
      });
      return;
    }
    next();
  });

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

  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('TaskBoard API')
      .setDescription('Task Management Dashboard — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  const port = process.env.PORT ?? 3000;
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
