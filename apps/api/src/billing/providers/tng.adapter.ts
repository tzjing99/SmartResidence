import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
  WebhookVerifyOptions,
} from './payment-provider.interface';

const DEFAULT_SANDBOX_CHECKOUT = 'https://sandbox-api.tngdigital.com.my/ewallet/v1/checkout';
const DEFAULT_LIVE_CHECKOUT = 'https://api.tngdigital.com.my/ewallet/v1/checkout';

export function tngOrderId(paymentId: string): string {
  return paymentId.replace(/-/g, '');
}

export function tngRequestSignature(input: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  apiKey: string;
}): string {
  const canonical = `${input.merchantId}|${input.orderId}|${input.amount}|${input.currency}`;
  return createHmac('sha256', input.apiKey).update(canonical).digest('hex');
}

export function tngCallbackSignature(body: Record<string, unknown>, webhookSecret: string): string {
  const canonical = [
    String(body.orderid ?? body.orderId ?? ''),
    String(body.transactionId ?? body.tranID ?? ''),
    String(body.amount ?? ''),
    String(body.currency ?? 'MYR'),
    String(body.status ?? ''),
  ].join('|');
  return createHmac('sha256', webhookSecret).update(canonical).digest('hex');
}

function checkoutBase(
  mode: PaymentIntentOptions['mode'],
  publicConfig?: Record<string, unknown>,
): string {
  const override = publicConfig?.apiBase;
  if (typeof override === 'string' && override.startsWith('http')) return override;
  return mode === 'LIVE' ? DEFAULT_LIVE_CHECKOUT : DEFAULT_SANDBOX_CHECKOUT;
}

function isSuccessStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return (
    normalized === 'SUCCESS' ||
    normalized === '00' ||
    normalized === 'COMPLETED' ||
    normalized === '1'
  );
}

@Injectable()
export class TngAdapter implements PaymentProviderAdapter {
  readonly id = 'TNG';
  private readonly logger = new Logger(TngAdapter.name);

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const creds = opts.credentials;
    const orderid = tngOrderId(opts.payment.id);
    const amount = Number(opts.payment.amount).toFixed(2);
    const currency = opts.invoice.currencyCode || 'MYR';

    if (!creds?.merchantId || !creds?.apiKey) {
      this.logger.warn('[SANDBOX] TNG eWallet not configured; returning mock redirect for dev.');
      return {
        redirectUrl: `${opts.returnUrl ?? 'http://localhost:3000/billing'}?mock=tng&ref=${orderid}`,
        providerRef: orderid,
      };
    }

    const signature = tngRequestSignature({
      merchantId: creds.merchantId,
      orderId: orderid,
      amount,
      currency,
      apiKey: creds.apiKey,
    });

    return {
      formPost: {
        url: checkoutBase(opts.mode, opts.publicConfig),
        fields: {
          merchantId: creds.merchantId,
          orderid,
          amount,
          currency,
          productDesc: `Invoice ${opts.invoice.number}`.slice(0, 100),
          returnUrl: opts.returnUrl ?? '',
          signature,
        },
      },
      providerRef: orderid,
    };
  }

  async verifyWebhook(opts: WebhookVerifyOptions) {
    const body = opts.body ?? {};
    const creds = opts.credentials;
    const orderid = String(body.orderid ?? body.orderId ?? '');
    const status = String(body.status ?? body.Status ?? '');
    if (!orderid) return null;

    if (body.sandbox === true && !creds?.webhookSecret) {
      if (!opts.allowUnsignedSandbox) {
        this.logger.warn(
          `[SANDBOX] Rejecting unsigned TNG settle for ${orderid} (not allowed in this environment)`,
        );
        return null;
      }
      this.logger.warn(`[SANDBOX] Accepting unsigned TNG settle for ${orderid}`);
      return { providerRef: orderid, succeeded: isSuccessStatus(status), raw: body };
    }

    if (!creds?.webhookSecret) return null;

    const signature = String(body.signature ?? body.Signature ?? '');
    const expected = tngCallbackSignature(body, creds.webhookSecret);
    if (!signature || !safeEqual(signature, expected)) {
      this.logger.warn(`TNG webhook signature mismatch for ${orderid}`);
      return null;
    }

    return { providerRef: orderid, succeeded: isSuccessStatus(status), raw: body };
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
