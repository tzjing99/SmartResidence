import type { Invoice, Payment } from '@prisma/client';

export interface PaymentIntentResult {
  clientSecret?: string;
  redirectUrl?: string;
  providerRef: string;
}

export interface PaymentProviderAdapter {
  readonly id: string;
  createIntent(opts: {
    invoice: Invoice;
    payment: Payment;
    returnUrl?: string;
  }): Promise<PaymentIntentResult>;

  /** Verify an inbound webhook payload and return the canonical payment status. */
  verifyWebhook(opts: {
    payload: string | Buffer;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{ providerRef: string; succeeded: boolean; raw: unknown } | null>;
}
