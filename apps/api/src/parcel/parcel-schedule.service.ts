import { DistributedLockService } from '@/redis/distributed-lock.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ParcelService } from './parcel.service';

/** Flags overdue uncollected parcels and notifies residents. Runs every hour. */
@Injectable()
export class ParcelScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ParcelScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 60 * 60_000;

  constructor(
    private readonly parcels: ParcelService,
    private readonly lock: DistributedLockService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Parcel overdue sweep failed: ${(err as Error).message}`),
      );
    }, ParcelScheduleService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Parcel overdue scheduler started (interval 1h)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const flagged = await this.lock.withLock('schedule:parcel-overdue', 3500, () =>
      this.parcels.detectOverdue(),
    );
    if (flagged == null) return 0;
    if (flagged > 0) {
      this.logger.log(`Flagged ${flagged} overdue parcel(s)`);
    }
    return flagged;
  }
}
