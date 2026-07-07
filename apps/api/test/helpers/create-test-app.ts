import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditLogInterceptor } from '../../src/common/interceptors/audit-log.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DistributedLockService } from '../../src/redis/distributed-lock.service';
import { RedisService } from '../../src/redis/redis.service';

/** In-memory token blocklist — mirrors RedisService blocklist:* keys for auth revoke. */
const blockedJtis = new Set<string>();

const blocklistKey = (jti: string) => `blocklist:${jti}`;

/**
 * In-memory Redis stand-in. Persists values across calls so cache-backed flows
 * (e.g. PDPA export: `set` on POST, `get` on download) work end-to-end in tests.
 */
function createMockRedisClient() {
  const store = new Map<string, string>();
  const client = {
    on: () => client,
    quit: async () => 'OK',
    set: async (key: string, value: string) => {
      if (key.startsWith('blocklist:') && value === '1') {
        blockedJtis.add(key.slice('blocklist:'.length));
      }
      store.set(key, value);
      return 'OK';
    },
    get: async (key: string) => store.get(key) ?? null,
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (key.startsWith('blocklist:')) {
          blockedJtis.delete(key.slice('blocklist:'.length));
        }
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    incr: async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    },
    eval: async () => 1,
    exists: async (...keys: string[]) =>
      keys.filter((key) => store.has(key) || blockedJtis.has(key.slice('blocklist:'.length)))
        .length,
  };
  return client;
}

/** Minimal RedisService stand-in for integration tests (no real Redis required). */
function createMockRedisService() {
  const client = createMockRedisClient();
  return {
    client,
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    isTokenBlocked: async (jti: string) => blockedJtis.has(jti),
    blocklistToken: async (jti: string, ttlSeconds?: number) => {
      if (ttlSeconds != null && ttlSeconds <= 0) return;
      blockedJtis.add(jti);
      await client.set(blocklistKey(jti), '1');
    },
  };
}

/** Bootstrap a NestJS app configured like production (global prefix, validation pipes). */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RedisService)
    .useValue(createMockRedisService())
    .overrideProvider(DistributedLockService)
    .useValue({
      withLock: async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
    })
    .overrideProvider(APP_GUARD)
    .useValue({ canActivate: async () => true })
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health', 'health/(.*)', 'metrics', 'metrics/(.*)'] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new AuditLogInterceptor(reflector, app.get(PrismaService)));
  await app.init();
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  return { app, prisma: app.get(PrismaService) };
}
