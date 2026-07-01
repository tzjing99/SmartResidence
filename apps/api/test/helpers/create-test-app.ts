import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaService } from '../../src/prisma/prisma.service';

/** Bootstrap a NestJS app configured like production (global prefix, validation pipes). */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health', 'health/(.*)'] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
