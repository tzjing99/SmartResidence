import { Public } from '@/auth/decorators/public.decorator';
import type { PrismaService } from '@/prisma/prisma.service';
import type { RedisService } from '@/redis/redis.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
    ]);

    const [db, cache] = checks;
    const ok = checks.every((c) => c.status === 'fulfilled');

    return {
      status: ok ? 'ok' : 'degraded',
      uptime: process.uptime(),
      checks: {
        database: db.status === 'fulfilled' ? 'up' : 'down',
        redis: cache.status === 'fulfilled' ? 'up' : 'down',
      },
      version: process.env.npm_package_version ?? 'dev',
      timestamp: new Date().toISOString(),
    };
  }
}
