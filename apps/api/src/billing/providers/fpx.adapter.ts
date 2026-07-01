import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';

/**
 * Generic FPX (Malaysia) stub. Real FPX flows are handled via the Fiuu / iPay88
 * aggregator adapters; this remains as a dev mock for the bare FPX provider.
 */
@Injectable()
export class FpxAdapter implements PaymentProviderAdapter {
  readonly id = 'FPX';
  private readonly logger = new Logger(FpxAdapter.name);

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    this.logger.log(`FPX stub creating intent for payment ${opts.payment.id}`);
    return {
      redirectUrl: `${opts.returnUrl ?? 'http://localhost:3000/billing'}?mock=fpx&ref=${opts.payment.id}`,
      providerRef: `fpx_${opts.payment.id}`,
    };
  }

  async verifyWebhook() {
    return null;
  }
}
