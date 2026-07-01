import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PollsService } from './polls.service';

/** Auto-closes polls when closesAt passes. Runs every minute. */
@Injectable()
export class PollScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PollScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  constructor(private readonly polls: PollsService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Poll auto-close sweep failed: ${(err as Error).message}`),
      );
    }, PollScheduleService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Poll auto-close scheduler started (interval 1m)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const closed = await this.polls.closeExpiredPolls();
    if (closed > 0) {
      this.logger.log(`Auto-closed ${closed} poll(s)`);
    }
    return closed;
  }
}
