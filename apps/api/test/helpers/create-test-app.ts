import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DistributedLockService } from '../../src/redis/distributed-lock.service';
import { RedisService } from '../../src/redis/redis.service';

const mockRedisClient = {
  on: () => mockRedisClient,
  quit: async () => 'OK',
  set: async () => 'OK',
  get: async () => null,
  del: async () => 1,
  eval: async () => 1,
  exists: async () => 0,
};

/** Minimal RedisService stand-in for integration tests (no real Redis required). */
const mockRedisService = {
  client: mockRedisClient,
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  isTokenBlocked: async (_jti: string) => false,
  blocklistToken: async (_jti: string, _ttlSeconds?: number) => {},
};

/** Bootstrap a NestJS app configured like production (global prefix, validation pipes). */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RedisService)
    .useValue(mockRedisService)
    .overrideProvider(DistributedLockService)
    .useValue({
      withLock: async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
    })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
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
