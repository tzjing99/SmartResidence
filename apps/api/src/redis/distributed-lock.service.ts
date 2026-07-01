import { RedisService } from '@/redis/redis.service';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * Redis SET NX EX locks so scheduled sweeps run on one API instance at a time.
 * Fails open on Redis errors (returns false) so a unreachable Redis does not
 * halt background jobs entirely.
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly redis: RedisService) {}

  /** Try to acquire `lock:${key}`; run `fn` when held; release in finally. */
  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
    const token = randomUUID();
    const lockKey = `lock:${key}`;
    let acquired = false;
    try {
      const ok = await this.redis.client.set(lockKey, token, 'EX', ttlSeconds, 'NX');
      if (ok !== 'OK') return null;
      acquired = true;
      return await fn();
    } catch (err) {
      this.logger.warn(`lock ${key} failed: ${(err as Error).message}`);
      return null;
    } finally {
      if (acquired) {
        try {
          const script = `
          if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
          else
            return 0
          end`;
          await this.redis.client.eval(script, 1, lockKey, token);
        } catch (err) {
          this.logger.warn(`lock release ${key} failed: ${(err as Error).message}`);
        }
      }
    }
  }
}
