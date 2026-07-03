import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DistributedLockService } from '../../src/redis/distributed-lock.service';
import { RedisService } from '../../src/redis/redis.service';

/** In-memory token blocklist — mirrors RedisService blocklist:* keys for auth revoke. */
const blockedJtis = new Set<string>();

const blocklistKey = (jti: string) => `blocklist:${jti}`;

const mockRedisClient = {
  on: () => mockRedisClient,
  quit: async () => 'OK',
  set: async (key: string, value: string) => {
    if (key.startsWith('blocklist:') && value === '1') {
      blockedJtis.add(key.slice('blocklist:'.length));
    }
    return 'OK';
  },
  get: async () => null,
  del: async (key: string) => {
    if (key.startsWith('blocklist:')) {
      blockedJtis.delete(key.slice('blocklist:'.length));
      return 1;
    }
    return 0;
  },
  eval: async () => 1,
  exists: async (key: string) => (blockedJtis.has(key.slice('blocklist:'.length)) ? 1 : 0),
};

/** Minimal RedisService stand-in for integration tests (no real Redis required). */
const mockRedisService = {
  client: mockRedisClient,
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  isTokenBlocked: async (jti: string) => blockedJtis.has(jti),
  blocklistToken: async (jti: string, ttlSeconds?: number) => {
    if (ttlSeconds != null && ttlSeconds <= 0) return;
    blockedJtis.add(jti);
    await mockRedisClient.set(blocklistKey(jti), '1');
  },
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
