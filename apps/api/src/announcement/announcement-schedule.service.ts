import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';

/**
 * Publishes scheduled announcements when their publish time arrives and sends the
 * "published" push to targeted residents. Runs every minute so a notice scheduled
 * for, say, 9:00 AM goes live within ~60s of that time.
 */
@Injectable()
export class AnnouncementScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  constructor(private readonly announcements: AnnouncementService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Scheduled announcement sweep failed: ${(err as Error).message}`),
      );
    }, AnnouncementScheduleService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Scheduled announcement publisher started (interval 1m)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const notified = await this.announcements.publishDueScheduled();
    if (notified > 0) {
      this.logger.log(`Published ${notified} scheduled announcement(s)`);
    }
    return notified;
  }
}
