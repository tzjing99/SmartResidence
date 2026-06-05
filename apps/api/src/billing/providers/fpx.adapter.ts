import { Injectable, Logger } from '@nestjs/common';
import type { PaymentIntentResult, PaymentProviderAdapter } from './payment-provider.interface';

/**
 * FPX (Malaysia) adapter. v0.1 ships a stub that returns a redirect to a
 * mock bank picker. Replace with a real iPay88/Razer/Billplz integration in
 * v0.2 — the adapter contract is stable.
 */
@Injectable()
export class FpxAdapter implements PaymentProviderAdapter {
  readonly id = 'FPX';
  private readonly logger = new Logger(FpxAdapter.name);

  async createIntent(
    opts: Parameters<PaymentProviderAdapter['createIntent']>[0],
  ): Promise<PaymentIntentResult> {
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
