import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { BillingAutomationService } from './billing-automation.service';

@Injectable()
export class BillingAutomationScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingAutomationScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 60 * 60_000;

  constructor(private readonly automation: BillingAutomationService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Billing automation sweep failed: ${(err as Error).message}`),
      );
    }, BillingAutomationScheduleService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Billing automation scheduler started (interval 1h)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    const summary = await this.automation.runDueAutomations();
    if (summary.created > 0 || summary.skipped > 0 || summary.skippedNoRate > 0) {
      this.logger.log(
        `Billing automation checked ${summary.checked} condo(s), ran ${summary.ran}, created ${summary.created}, skipped ${summary.skipped}, skipped no-rate ${summary.skippedNoRate}`,
      );
    }
    return summary;
  }
}
