import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
  WebhookVerifyOptions,
} from './payment-provider.interface';

const SANDBOX_BASE = 'https://sandbox-payment.fiuu.com/RMS/pay';
const LIVE_BASE = 'https://pay.fiuu.com/RMS/pay';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/** Fiuu allows up to 40 chars; UUID without hyphens is exactly 32 hex chars. */
export function fiuuOrderId(paymentId: string): string {
  return paymentId.replace(/-/g, '');
}

export function fiuuVcode(input: {
  amount: string;
  merchantId: string;
  orderid: string;
  verifyKey: string;
  currency?: string;
  extended?: boolean;
}): string {
  const base = `${input.amount}${input.merchantId}${input.orderid}${input.verifyKey}`;
  const payload = input.extended && input.currency ? `${base}${input.currency}` : base;
  return md5(payload);
}

/**
 * Fiuu (formerly Razer Merchant Services / MOLPay) adapter — Malaysia FPX,
 * e-wallets and cards. Credentials: { merchantId, verifyKey, secretKey }.
 * The redirect flow posts to the Fiuu hosted page; the server-to-server
 * callback (and the browser return) are verified with the `skey` signature.
 */
@Injectable()
export class FiuuAdapter implements PaymentProviderAdapter {
  readonly id = 'RAZER';
  private readonly logger = new Logger(FiuuAdapter.name);

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const creds = opts.credentials;
    const orderid = fiuuOrderId(opts.payment.id);
    if (!creds?.merchantId || !creds?.verifyKey) {
      this.logger.warn('Fiuu not configured; returning mock redirect for dev.');
      return {
        redirectUrl: `${opts.returnUrl ?? 'http://localhost:3000/billing'}?mock=fiuu&ref=${orderid}`,
        providerRef: orderid,
      };
    }

    const amount = Number(opts.payment.amount).toFixed(2);
    const currency = opts.invoice.currencyCode || 'MYR';
    const base = opts.mode === 'LIVE' ? LIVE_BASE : SANDBOX_BASE;
    // Default extended vcode (amount+merchant+order+verify+currency) — common for MYR
    // merchants. Disable via gateway publicConfig.extendedVcode = false if Fiuu portal
    // has "Use extended format for Verify Payment" turned off.
    const extendedVcode = opts.publicConfig?.extendedVcode !== false;
    const vcode = fiuuVcode({
      amount,
      merchantId: creds.merchantId,
      orderid,
      verifyKey: creds.verifyKey,
      currency,
      extended: extendedVcode,
    });

    const fields: Record<string, string> = {
      amount,
      orderid,
      bill_name: creds.billName ?? 'Resident',
      bill_email: creds.billEmail ?? 'resident@example.com',
      bill_desc: `Invoice ${opts.invoice.number}`.slice(0, 64),
      country: (creds.country as string | undefined) ?? 'MY',
      currency,
      vcode,
      returnurl: opts.returnUrl ?? '',
    };
    const mobile = creds.billMobile?.trim();
    if (mobile) fields.bill_mobile = mobile;

    return {
      formPost: { url: `${base}/${creds.merchantId}/`, fields },
      providerRef: orderid,
    };
  }

  async verifyWebhook(opts: WebhookVerifyOptions) {
    const body = opts.body ?? {};
    const creds = opts.credentials;
    if (!creds?.secretKey) return null;

    const tranID = String(body.tranID ?? '');
    const orderid = String(body.orderid ?? '');
    const status = String(body.status ?? '');
    const domain = String(body.domain ?? '');
    const amount = String(body.amount ?? '');
    const currency = String(body.currency ?? '');
    const appcode = String(body.appcode ?? '');
    const paydate = String(body.paydate ?? '');
    const skey = String(body.skey ?? '');

    // Fiuu skey: key0 = md5(tranID+orderid+status+domain+amount+currency);
    //            key1 = md5(paydate+domain+key0+appcode+secretKey)
    const key0 = md5(`${tranID}${orderid}${status}${domain}${amount}${currency}`);
    const key1 = md5(`${paydate}${domain}${key0}${appcode}${creds.secretKey}`);
    if (skey !== key1) {
      this.logger.warn(`Fiuu skey mismatch for order ${orderid}`);
      return null;
    }
    return { providerRef: orderid, succeeded: status === '00', raw: body };
  }
}
