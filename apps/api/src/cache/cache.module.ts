import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module. Relies on the (also global) RedisModule for the shared
 * ioredis connection, so any feature module can inject CacheService directly.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
