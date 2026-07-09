import { RedisService } from '@/redis/redis.service';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Thin Redis-backed cache for frequently-read, rarely-changing reference data
 * (e.g. FAQ articles, condo/block lookups).
 *
 * Design goals:
 * - Reuse the existing shared ioredis connection (no extra client).
 * - Fail open: any Redis error degrades to a direct DB read rather than
 *   breaking the request. The cache is an optimization, never a dependency.
 * - JSON (de)serialization is handled here so callers work with plain objects.
 *
 * Invalidation uses a per-namespace version counter rather than key scanning:
 * cached keys embed the current namespace version, and a write simply bumps the
 * version so every previously-cached key becomes unreachable and expires by TTL.
 * This avoids `KEYS`/`SCAN` and is O(1) per invalidation.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  private get client() {
    return this.redis.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`cache get failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache set failed for ${key}: ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    const valid = keys.filter(Boolean);
    if (valid.length === 0) return;
    try {
      await this.client.del(...valid);
    } catch (err) {
      this.logger.warn(`cache del failed: ${(err as Error).message}`);
    }
  }

  /** Get the cached value or compute, store, and return it. Never caches null/undefined. */
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  /** Current version for a namespace (defaults to 1 when unset or unreachable). */
  private async namespaceVersion(namespace: string): Promise<number> {
    try {
      const v = await this.client.get(`cachever:${namespace}`);
      // Default 0 so the first `incr` (→ 1) actually retires keys written before any bump.
      // Using 1 here made the first invalidate a no-op (missing key and incr both read as 1).
      return v ? Number(v) : 0;
    } catch {
      return 0;
    }
  }

  /** Invalidate every key in a namespace by bumping its version counter. */
  async invalidateNamespace(namespace: string): Promise<void> {
    try {
      await this.client.incr(`cachever:${namespace}`);
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${namespace}: ${(err as Error).message}`);
    }
  }

  /**
   * Versioned variant of {@link wrap}. The effective cache key is
   * `<namespace>:v<version>:<keySuffix>`, so {@link invalidateNamespace}
   * atomically retires the whole namespace.
   */
  async wrapNamespaced<T>(
    namespace: string,
    keySuffix: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const version = await this.namespaceVersion(namespace);
    return this.wrap(`${namespace}:v${version}:${keySuffix}`, ttlSeconds, fn);
  }
}
