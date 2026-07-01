import { PrismaService } from '@/prisma/prisma.service';
import { DistributedLockService } from '@/redis/distributed-lock.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { VisitorService } from './visitor.service';

/**
 * Periodically closes visitors still checked in from prior condo calendar days.
 * Prevents guards from having to manually check out stale records at 6am (and
 * the surprise notifications that follow in legacy systems).
 */
@Injectable()
export class VisitorAutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisitorAutoCloseService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 15 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly visitors: VisitorService,
    private readonly lock: DistributedLockService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Visitor auto-close sweep failed: ${(err as Error).message}`),
      );
    }, VisitorAutoCloseService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Visitor auto-close sweeper started (interval 15m)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const closed = await this.lock.withLock('schedule:visitor-auto-close', 840, async () => {
      const condos = await this.prisma.visitor.findMany({
        where: { status: 'CHECKED_IN' },
        select: { condoId: true },
        distinct: ['condoId'],
      });
      let total = 0;
      for (const { condoId } of condos) {
        total += await this.visitors.autoCloseStaleVisitors(condoId);
      }
      return total;
    });
    if (closed == null) return 0;
    if (closed > 0) {
      this.logger.log(`Auto-closed ${closed} stale visitor check-in(s)`);
    }
    return closed;
  }
}
