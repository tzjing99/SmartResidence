import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
  QrPollStatusResult,
  WebhookVerifyOptions,
} from './payment-provider.interface';

/**
 * PayNet DuitNow QR API bases (participating bank / acquirer endpoints vary; these
 * are the conventional sandbox/production hostnames used in integration guides).
 * A production deployment may override via gateway publicConfig.apiBase.
 */
const DEFAULT_SANDBOX_API = 'https://sandbox-api.paynet.my/duitnow-qr/v1';
const DEFAULT_LIVE_API = 'https://api.paynet.my/duitnow-qr/v1';

/** DuitNow bill reference — alphanumeric, max 30 chars for most acquirers. */
export function duitnowBillRef(paymentId: string): string {
  return paymentId.replace(/-/g, '').slice(0, 30);
}

/**
 * Build a deterministic sandbox EMVCo-style payload. Real dynamic QR strings are
 * issued by PayNet / the acquirer API; this stub is network-free for dev/TEST.
 */
export function buildSandboxDuitNowQrPayload(input: {
  merchantId: string;
  billRef: string;
  amount: string;
  currency: string;
  merchantName?: string;
}): string {
  const name = (input.merchantName ?? 'SmartResidence').slice(0, 25);
  return [
    '000201',
    '010211',
    '26',
    `0016MY.DUITNOW.QR0112${input.merchantId}`,
    '52',
    '0004',
    '0000',
    '53',
    '0003',
    input.currency,
    '54',
    String(input.amount.length).padStart(2, '0'),
    input.amount,
    '58',
    '0002',
    'MY',
    '59',
    String(name.length).padStart(2, '0'),
    name,
    '62',
    String(7 + input.billRef.length).padStart(2, '0'),
    `05${String(input.billRef.length).padStart(2, '0')}${input.billRef}`,
    '6304',
  ].join('');
}

/** Append CRC16-CCITT-FALSE checksum (4 hex chars) required by EMVCo QR payloads. */
export function emvQrCrc(payloadWithoutCrc: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCrc.length; i++) {
    crc ^= payloadWithoutCrc.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function finalizeEmvQrPayload(base: string): string {
  const withoutCrc = base.endsWith('6304') ? base : `${base}6304`;
  return `${withoutCrc}${emvQrCrc(withoutCrc)}`;
}

export function duitnowWebhookSignature(body: Record<string, unknown>, secret: string): string {
  const canonical = [
    String(body.billRef ?? ''),
    String(body.endToEndId ?? ''),
    String(body.amount ?? ''),
    String(body.currency ?? 'MYR'),
    String(body.status ?? ''),
  ].join('|');
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

function apiBase(
  mode: PaymentIntentOptions['mode'],
  publicConfig?: Record<string, unknown>,
): string {
  const override = publicConfig?.apiBase;
  if (typeof override === 'string' && override.startsWith('http')) return override;
  return mode === 'LIVE' ? DEFAULT_LIVE_API : DEFAULT_SANDBOX_API;
}

/**
 * DuitNow QR adapter — Malaysia PayNet dynamic QR for invoice and advance
 * maintenance payments. Credentials: { merchantId, clientId, clientSecret,
 * webhookSecret }. When credentials are absent the adapter returns a local
 * sandbox QR (no network) so residents can exercise the scan UX; settlement
 * uses the signed webhook or the documented sandbox settle seam.
 */
@Injectable()
export class DuitNowAdapter implements PaymentProviderAdapter {
  readonly id = 'DUITNOW_QR';
  private readonly logger = new Logger(DuitNowAdapter.name);

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const creds = opts.credentials;
    const billRef = duitnowBillRef(opts.payment.id);
    const amount = Number(opts.payment.amount).toFixed(2);
    const currency = opts.invoice.currencyCode || 'MYR';
    const merchantName =
      (opts.publicConfig?.merchantName as string | undefined) ??
      creds?.merchantName ??
      'Condo Management';

    if (!creds?.merchantId || !creds?.clientId || !creds?.clientSecret) {
      this.logger.warn(
        '[SANDBOX] DuitNow QR not configured; returning locally generated QR (no PayNet call).',
      );
      const qrPayload = finalizeEmvQrPayload(
        buildSandboxDuitNowQrPayload({
          merchantId: 'SANDBOX',
          billRef,
          amount,
          currency,
          merchantName,
        }),
      );
      const qrImageUrl = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2 });
      return { providerRef: billRef, qrPayload, qrImageUrl };
    }

    const base = apiBase(opts.mode, opts.publicConfig);
    const token = await this.fetchAccessToken(base, creds.clientId, creds.clientSecret);
    const response = await fetch(`${base}/merchants/${creds.merchantId}/qr/dynamic`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        billRef,
        amount: { value: amount, currency },
        description: `Invoice ${opts.invoice.number}`.slice(0, 140),
        merchantName,
        expiryMinutes: 15,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`DuitNow QR create failed (${response.status}): ${text.slice(0, 200)}`);
      throw new Error('Unable to create DuitNow QR. Please try again or contact management.');
    }

    const data = (await response.json()) as {
      qrString?: string;
      qrPayload?: string;
      qrImageUrl?: string;
      endToEndId?: string;
    };
    const qrPayload = data.qrString ?? data.qrPayload;
    if (!qrPayload) {
      throw new Error('DuitNow QR response did not include a scannable payload.');
    }

    let qrImageUrl = data.qrImageUrl;
    if (!qrImageUrl) {
      qrImageUrl = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2 });
    }

    return {
      providerRef: billRef,
      qrPayload,
      qrImageUrl,
    };
  }

  async verifyWebhook(opts: WebhookVerifyOptions) {
    const body = opts.body ?? {};
    const creds = opts.credentials;
    const billRef = String(body.billRef ?? body.refNo ?? body.orderid ?? '');
    const status = String(body.status ?? body.Status ?? '').toUpperCase();
    if (!billRef) return null;

    // Dev/sandbox seam: unsigned settle when explicitly flagged, no webhook secret,
    // and the caller opted in (never in production).
    if (body.sandbox === true && !creds?.webhookSecret) {
      if (!opts.allowUnsignedSandbox) {
        this.logger.warn(
          `[SANDBOX] Rejecting unsigned DuitNow settle for ${billRef} (not allowed in this environment)`,
        );
        return null;
      }
      this.logger.warn(`[SANDBOX] Accepting unsigned DuitNow settle for ${billRef}`);
      return {
        providerRef: billRef,
        succeeded: status === 'SUCCESS' || status === '00' || status === '1',
        raw: body,
      };
    }

    if (!creds?.webhookSecret) return null;

    const signature = String(body.signature ?? body.Signature ?? '');
    const expected = duitnowWebhookSignature(body, creds.webhookSecret);
    if (!signature || !safeEqual(signature, expected)) {
      this.logger.warn(`DuitNow webhook signature mismatch for ${billRef}`);
      return null;
    }

    const succeeded = status === 'SUCCESS' || status === '00' || status === '1';
    return { providerRef: billRef, succeeded, raw: body };
  }

  async pollStatus(opts: {
    providerRef: string;
    credentials?: Record<string, string>;
    mode?: PaymentIntentOptions['mode'];
  }): Promise<QrPollStatusResult | null> {
    const creds = opts.credentials;
    if (!creds?.merchantId || !creds?.clientId || !creds?.clientSecret) return null;

    const base = apiBase(opts.mode, undefined);
    try {
      const token = await this.fetchAccessToken(base, creds.clientId, creds.clientSecret);
      const response = await fetch(
        `${base}/merchants/${creds.merchantId}/transactions/${encodeURIComponent(opts.providerRef)}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { status?: string };
      const status = String(data.status ?? '').toUpperCase();
      if (status === 'SUCCESS' || status === '00') {
        return { succeeded: true, failed: false, pending: false };
      }
      if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
        return { succeeded: false, failed: true, pending: false };
      }
      return { succeeded: false, failed: false, pending: true };
    } catch (err) {
      this.logger.warn(`DuitNow poll failed for ${opts.providerRef}: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchAccessToken(base: string, clientId: string, clientSecret: string) {
    const cacheKey = createHash('sha256').update(`${base}:${clientId}`).digest('hex').slice(0, 16);
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

    const response = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(`DuitNow OAuth failed (${response.status})`);
    }
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('DuitNow OAuth response missing access_token');
    tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });
    return data.access_token;
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
