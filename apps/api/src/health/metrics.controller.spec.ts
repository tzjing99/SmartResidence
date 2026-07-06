import type { AppEnv } from '@/config/env.schema';
import type { PrismaService } from '@/prisma/prisma.service';
import type { RedisService } from '@/redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsController } from './metrics.controller';
import { MetricsService, formatPrometheusMetrics, isLocalhostAddress } from './metrics.service';

describe('formatPrometheusMetrics', () => {
  it('renders uptime, heap, request count, and dependency gauges', () => {
    const body = formatPrometheusMetrics({
      uptimeSeconds: 42.5,
      heapUsedBytes: 1_000_000,
      heapTotalBytes: 2_000_000,
      requestsTotal: 7,
      postgresUp: true,
      redisUp: false,
    });

    expect(body).toContain('# TYPE process_uptime_seconds gauge');
    expect(body).toContain('process_uptime_seconds 42.5');
    expect(body).toContain('nodejs_heap_used_bytes 1000000');
    expect(body).toContain('http_requests_total 7');
    expect(body).toContain('dependency_up{dependency="postgres"} 1');
    expect(body).toContain('dependency_up{dependency="redis"} 0');
  });
});

describe('isLocalhostAddress', () => {
  it('accepts loopback addresses', () => {
    expect(isLocalhostAddress('127.0.0.1')).toBe(true);
    expect(isLocalhostAddress('::1')).toBe(true);
    expect(isLocalhostAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('rejects non-loopback addresses', () => {
    expect(isLocalhostAddress('192.168.1.1')).toBe(false);
    expect(isLocalhostAddress(undefined)).toBe(false);
  });
});

describe('MetricsService', () => {
  it('increments the request counter', () => {
    const svc = new MetricsService();
    expect(svc.getRequestsTotal()).toBe(0);
    svc.incrementRequests();
    svc.incrementRequests();
    expect(svc.getRequestsTotal()).toBe(2);
  });
});

describe('MetricsController', () => {
  let controller: MetricsController;
  let config: ConfigService<AppEnv, true>;
  let prisma: PrismaService;
  let redis: RedisService;
  let metrics: MetricsService;

  beforeEach(() => {
    config = {
      get: vi.fn((key: keyof AppEnv) => (key === 'METRICS_ENABLED' ? true : undefined)),
    } as unknown as ConfigService<AppEnv, true>;
    prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    redis = {
      client: { ping: vi.fn().mockResolvedValue('PONG') },
    } as unknown as RedisService;
    metrics = new MetricsService();
    metrics.incrementRequests();
    controller = new MetricsController(config, prisma, redis, metrics);
  });

  function mockReq(ip: string): Parameters<MetricsController['scrape']>[0] {
    return { ip, socket: { remoteAddress: ip } } as Parameters<MetricsController['scrape']>[0];
  }

  function mockRes(): Parameters<MetricsController['scrape']>[1] {
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    return res as unknown as Parameters<MetricsController['scrape']>[1];
  }

  it('returns Prometheus text for localhost when enabled', async () => {
    const res = mockRes();
    await controller.scrape(mockReq('127.0.0.1'), res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('http_requests_total 1'));
  });

  it('returns 404 when metrics are disabled', async () => {
    vi.mocked(config.get).mockReturnValue(false);
    await expect(controller.scrape(mockReq('127.0.0.1'), mockRes())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 404 for non-localhost callers', async () => {
    await expect(controller.scrape(mockReq('10.0.0.5'), mockRes())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
