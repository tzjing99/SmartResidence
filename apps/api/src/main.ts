import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from './prisma/prisma.service';
import type { AppEnv } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const logger = new Logger('bootstrap');

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
