import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
  WebhookVerifyOptions,
} from './payment-provider.interface';

const SANDBOX_ENTRY = 'https://sandbox.ipay88.com.my/epayment/entry.asp';
const LIVE_ENTRY = 'https://payment.ipay88.com.my/epayment/entry.asp';

/** iPay88 SHA256 signature, base64-encoded. Amount has separators stripped. */
function ipay88Signature(parts: string[]): string {
  return createHash('sha256').update(parts.join('')).digest('base64');
}

const stripAmount = (amount: string) => amount.replace(/[.,]/g, '');

/**
 * iPay88 (Malaysia) adapter — FPX, cards, e-wallets via the hosted entry page.
 * Credentials: { merchantCode, merchantKey }. Requests and responses are signed
 * with SHA256(MerchantKey + ... ) base64.
 */
@Injectable()
export class IPay88Adapter implements PaymentProviderAdapter {
  readonly id = 'IPAY88';
  private readonly logger = new Logger(IPay88Adapter.name);

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const creds = opts.credentials;
    const refNo = opts.payment.id;
    if (!creds?.merchantCode || !creds?.merchantKey) {
      this.logger.warn('iPay88 not configured; returning mock redirect for dev.');
      return {
        redirectUrl: `${opts.returnUrl ?? 'http://localhost:3000/billing'}?mock=ipay88&ref=${refNo}`,
        providerRef: refNo,
      };
    }

    const amount = Number(opts.payment.amount).toFixed(2);
    const currency = opts.invoice.currencyCode;
    const signature = ipay88Signature([
      creds.merchantKey,
      creds.merchantCode,
      refNo,
      stripAmount(amount),
      currency,
    ]);

    const fields: Record<string, string> = {
      MerchantCode: creds.merchantCode,
      RefNo: refNo,
      Amount: amount,
      Currency: currency,
      ProdDesc: `Invoice ${opts.invoice.number}`,
      UserName: creds.userName ?? 'Resident',
      UserEmail: creds.userEmail ?? 'resident@example.com',
      UserContact: creds.userContact ?? '',
      SignatureType: 'SHA256',
      Signature: signature,
      ResponseURL: opts.returnUrl ?? '',
      Lang: 'UTF-8',
    };

    return {
      formPost: { url: opts.mode === 'LIVE' ? LIVE_ENTRY : SANDBOX_ENTRY, fields },
      providerRef: refNo,
    };
  }

  async verifyWebhook(opts: WebhookVerifyOptions) {
    const body = opts.body ?? {};
    const creds = opts.credentials;
    if (!creds?.merchantKey) return null;

    const merchantCode = String(body.MerchantCode ?? '');
    const paymentId = String(body.PaymentId ?? '');
    const refNo = String(body.RefNo ?? '');
    const amount = String(body.Amount ?? '');
    const currency = String(body.Currency ?? '');
    const status = String(body.Status ?? '');
    const signature = String(body.Signature ?? '');

    const expected = ipay88Signature([
      creds.merchantKey,
      merchantCode,
      paymentId,
      refNo,
      stripAmount(amount),
      currency,
      status,
    ]);
    if (signature !== expected) {
      this.logger.warn(`iPay88 signature mismatch for ref ${refNo}`);
      return null;
    }
    return { providerRef: refNo, succeeded: status === '1', raw: body };
  }
}
