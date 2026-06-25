import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { HANDOVER_REPORT_JSON_BODY_LIMIT } from '@smartresidence/shared-types';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import type { AppEnv } from './config/env.schema';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const logger = new Logger('bootstrap');

  // Multi-defect submissions can carry hundreds of line items (~1–2 MB JSON).
  app.use(json({ limit: HANDOVER_REPORT_JSON_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: HANDOVER_REPORT_JSON_BODY_LIMIT }));

  app.setGlobalPrefix('api', { exclude: ['health', 'health/(.*)'] });

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new AuditLogInterceptor(reflector, app.get(PrismaService)),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartResidence API')
    .setDescription('REST API for the SmartResidence condo management platform.')
    .setVersion(process.env.npm_package_version ?? '0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access')
    .addCookieAuth('sr.session')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`SmartResidence API ready on http://localhost:${port}`);
  logger.log(`API docs: http://localhost:${port}/api/docs`);
}

bootstrap();
