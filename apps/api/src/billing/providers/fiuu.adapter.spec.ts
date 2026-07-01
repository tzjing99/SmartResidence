import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FiuuAdapter, fiuuOrderId, fiuuVcode } from './fiuu.adapter';

const adapter = new FiuuAdapter();
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const credentials = { merchantId: 'MID', verifyKey: 'VK', secretKey: 'SK' };

describe('FiuuAdapter.createIntent', () => {
  it('uses a 32-char order id and extended vcode by default', async () => {
    const paymentId = '25da8ca7-2f0f-4185-89cf-9efb60480faf';
    const intent = await adapter.createIntent({
      invoice: {
        number: 'INV-1',
        currencyCode: 'MYR',
        total: 100,
      } as never,
      payment: { id: paymentId, amount: 100 } as never,
      credentials: { merchantId: 'neecreativeartc', verifyKey: 'test-verify-key' },
      returnUrl: 'http://localhost/return',
      mode: 'TEST',
    });
    expect(intent.formPost?.fields.orderid).toBe(fiuuOrderId(paymentId));
    expect(intent.formPost?.fields.orderid).toHaveLength(32);
    expect(intent.formPost?.fields.country).toBe('MY');
    expect(intent.formPost?.fields.vcode).toBe(
      fiuuVcode({
        amount: '100.00',
        merchantId: 'neecreativeartc',
        orderid: fiuuOrderId(paymentId),
        verifyKey: 'test-verify-key',
        currency: 'MYR',
        extended: true,
      }),
    );
    expect(intent.formPost?.url).toBe('https://sandbox-payment.fiuu.com/RMS/pay/neecreativeartc/');
  });
});

describe('FiuuAdapter.verifyWebhook', () => {
  function signedBody(status: string) {
    const base = {
      tranID: 'T1',
      orderid: 'pay-1',
      status,
      domain: 'MID',
      amount: '100.00',
      currency: 'MYR',
      appcode: 'A1',
      paydate: '2026-06-25 10:00:00',
    };
    const key0 = md5(
      `${base.tranID}${base.orderid}${base.status}${base.domain}${base.amount}${base.currency}`,
    );
    const skey = md5(`${base.paydate}${base.domain}${key0}${base.appcode}${credentials.secretKey}`);
    return { ...base, skey };
  }

  it('accepts a correctly-signed successful callback', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: signedBody('00'),
      credentials,
    });
    expect(verified).toMatchObject({ providerRef: 'pay-1', succeeded: true });
  });

  it('reports non-success status without throwing', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: signedBody('11'),
      credentials,
    });
    expect(verified).toMatchObject({ providerRef: 'pay-1', succeeded: false });
  });

  it('rejects a tampered skey', async () => {
    const body = { ...signedBody('00'), skey: 'tampered' };
    const verified = await adapter.verifyWebhook({ payload: '', headers: {}, body, credentials });
    expect(verified).toBeNull();
  });
});
