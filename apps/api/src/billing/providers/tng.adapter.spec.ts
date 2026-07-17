import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TngAdapter, tngCallbackSignature, tngOrderId, tngRequestSignature } from './tng.adapter';

const adapter = new TngAdapter();
const credentials = { merchantId: 'TNG-MID', apiKey: 'api-key', webhookSecret: 'whsec' };

describe('TngAdapter.createIntent', () => {
  it('returns sandbox redirect when credentials are missing', async () => {
    const paymentId = '25da8ca7-2f0f-4185-89cf-9efb60480faf';
    const intent = await adapter.createIntent({
      invoice: { number: 'INV-1', currencyCode: 'MYR', total: 150 } as never,
      payment: { id: paymentId, amount: 150 } as never,
      returnUrl: 'http://localhost/billing',
      mode: 'TEST',
    });
    expect(intent.providerRef).toBe(tngOrderId(paymentId));
    expect(intent.redirectUrl).toContain('mock=tng');
  });

  it('builds signed form post when credentials are present', async () => {
    const paymentId = '25da8ca7-2f0f-4185-89cf-9efb60480faf';
    const orderid = tngOrderId(paymentId);
    const intent = await adapter.createIntent({
      invoice: { number: 'INV-1', currencyCode: 'MYR', total: 100 } as never,
      payment: { id: paymentId, amount: 100 } as never,
      credentials: { merchantId: 'TNG-MID', apiKey: 'api-key' },
      returnUrl: 'http://localhost/return',
      mode: 'TEST',
    });
    expect(intent.formPost?.url).toBe('https://sandbox-api.tngdigital.com.my/ewallet/v1/checkout');
    expect(intent.formPost?.fields.signature).toBe(
      tngRequestSignature({
        merchantId: 'TNG-MID',
        orderId: orderid,
        amount: '100.00',
        currency: 'MYR',
        apiKey: 'api-key',
      }),
    );
  });
});

describe('TngAdapter.verifyWebhook', () => {
  function signedBody(status: string) {
    const body = {
      orderid: 'payref1',
      transactionId: 'TX1',
      amount: '100.00',
      currency: 'MYR',
      status,
    };
    return { ...body, signature: tngCallbackSignature(body, credentials.webhookSecret) };
  }

  it('accepts a correctly signed successful callback', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: signedBody('SUCCESS'),
      credentials,
    });
    expect(verified).toMatchObject({ providerRef: 'payref1', succeeded: true });
  });

  it('accepts sandbox settle without webhook secret when allowUnsignedSandbox', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: { orderid: 'payref1', status: 'SUCCESS', sandbox: true },
      credentials: {},
      allowUnsignedSandbox: true,
    });
    expect(verified).toMatchObject({ providerRef: 'payref1', succeeded: true });
  });

  it('rejects unsigned sandbox settle when allowUnsignedSandbox is false', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: { orderid: 'payref1', status: 'SUCCESS', sandbox: true },
      credentials: {},
      allowUnsignedSandbox: false,
    });
    expect(verified).toBeNull();
  });
});

describe('tngRequestSignature', () => {
  it('is deterministic', () => {
    const input = {
      merchantId: 'MID',
      orderId: 'order1',
      amount: '50.00',
      currency: 'MYR',
      apiKey: 'key',
    };
    expect(tngRequestSignature(input)).toBe(
      createHmac('sha256', 'key').update('MID|order1|50.00|MYR').digest('hex'),
    );
  });
});
