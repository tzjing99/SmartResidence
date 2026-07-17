import type { GatewayMode, Invoice, Payment } from '@prisma/client';

export interface PaymentIntentResult {
  clientSecret?: string;
  redirectUrl?: string;
  /** Fields a self-submitting form should POST to the gateway (redirect flows). */
  formPost?: { url: string; fields: Record<string, string> };
  /** EMVCo / DuitNow QR string for the resident to scan. */
  qrPayload?: string;
  /** Base64 PNG data URL of the QR (optional convenience for clients without a QR lib). */
  qrImageUrl?: string;
  providerRef: string;
}

/** Optional status poll result for QR rails that support inquiry APIs. */
export interface QrPollStatusResult {
  succeeded: boolean;
  failed: boolean;
  pending: boolean;
}

/** Decrypted, non-persisted gateway credentials passed per request. */
export type GatewayCredentials = Record<string, string>;

export interface PaymentIntentOptions {
  invoice: Invoice;
  payment: Payment;
  returnUrl?: string;
  credentials?: GatewayCredentials;
  publicConfig?: Record<string, unknown>;
  mode?: GatewayMode;
}

export interface WebhookVerifyOptions {
  payload: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  credentials?: GatewayCredentials;
  /**
   * When true, adapters may accept an explicit `sandbox: true` unsigned settle
   * (dev/test only). Must never be set in production — otherwise a missing
   * webhook secret would let anyone forge payment success.
   */
  allowUnsignedSandbox?: boolean;
}

export interface PaymentProviderAdapter {
  readonly id: string;
  createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult>;

  /** Verify an inbound webhook payload and return the canonical payment status. */
  verifyWebhook(
    opts: WebhookVerifyOptions,
  ): Promise<{ providerRef: string; succeeded: boolean; raw: unknown } | null>;

  /** Poll gateway inquiry API for QR payment status (optional; DuitNow QR). */
  pollStatus?(opts: {
    providerRef: string;
    credentials?: GatewayCredentials;
    mode?: GatewayMode;
  }): Promise<QrPollStatusResult | null>;
}
