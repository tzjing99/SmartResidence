import { Injectable, type OnModuleDestroy, type OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppEnv } from '@/config/env.schema';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService<AppEnv, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async onModuleInit() {
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.on('ready', () => this.logger.log('Redis connected'));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /** Add a token id to the blocklist with a TTL until natural expiry. */
  async blocklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`blocklist:${jti}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlocked(jti: string): Promise<boolean> {
    return (await this.client.exists(`blocklist:${jti}`)) === 1;
  }
}
