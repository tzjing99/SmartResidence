import { DistributedLockService } from '@/redis/distributed-lock.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PatrolService } from './patrol.service';

/** Flags overdue patrol checkpoints and notifies management. Runs every 5m. */
@Injectable()
export class PatrolScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatrolScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 5 * 60_000;

  constructor(
    private readonly patrol: PatrolService,
    private readonly lock: DistributedLockService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Patrol overdue sweep failed: ${(err as Error).message}`),
      );
    }, PatrolScheduleService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Patrol overdue scheduler started (interval 5m)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const flagged = await this.lock.withLock('schedule:patrol-overdue', 270, () =>
      this.patrol.detectOverdue(),
    );
    if (flagged == null) return 0;
    if (flagged > 0) {
      this.logger.log(`Flagged ${flagged} overdue patrol checkpoint(s)`);
    }
    return flagged;
  }
}
