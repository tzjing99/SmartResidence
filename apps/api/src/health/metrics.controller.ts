import { Public } from '@/auth/decorators/public.decorator';
import type { AppEnv } from '@/config/env.schema';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MetricsService, formatPrometheusMetrics, isLocalhostAddress } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
@Public()
export class MetricsController {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  async scrape(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.config.get('METRICS_ENABLED', { infer: true })) {
      throw new NotFoundException();
    }

    const remote = req.ip ?? req.socket.remoteAddress;
    if (!isLocalhostAddress(remote)) {
      throw new NotFoundException();
    }

    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
    ]);
    const [db, cache] = checks;
    const mem = process.memoryUsage();

    const body = formatPrometheusMetrics({
      uptimeSeconds: process.uptime(),
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      requestsTotal: this.metrics.getRequestsTotal(),
      postgresUp: db.status === 'fulfilled',
      redisUp: cache.status === 'fulfilled',
    });

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(body);
  }
}
