import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DuitNowAdapter,
  buildSandboxDuitNowQrPayload,
  duitnowBillRef,
  duitnowWebhookSignature,
  finalizeEmvQrPayload,
} from './duitnow.adapter';

const adapter = new DuitNowAdapter();
const credentials = {
  merchantId: 'MID123',
  clientId: 'client',
  clientSecret: 'secret',
  webhookSecret: 'whsec',
};

describe('duitnowBillRef', () => {
  it('strips hyphens and caps length at 30', () => {
    const id = '25da8ca7-2f0f-4185-89cf-9efb60480faf';
    const ref = duitnowBillRef(id);
    expect(ref).toBe(id.replace(/-/g, '').slice(0, 30));
    expect(ref).toHaveLength(30);
  });
});

describe('DuitNowAdapter.createIntent', () => {
  it('returns sandbox QR payload and image when credentials are missing', async () => {
    const paymentId = '25da8ca7-2f0f-4185-89cf-9efb60480faf';
    const intent = await adapter.createIntent({
      invoice: { number: 'INV-1', currencyCode: 'MYR', total: 150 } as never,
      payment: { id: paymentId, amount: 150 } as never,
      mode: 'TEST',
    });
    expect(intent.providerRef).toBe(duitnowBillRef(paymentId));
    expect(intent.qrPayload).toBeTruthy();
    expect(intent.qrPayload).toMatch(/^000201/);
    expect(intent.qrImageUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe('buildSandboxDuitNowQrPayload', () => {
  it('includes amount and bill reference in EMVCo structure', () => {
    const base = buildSandboxDuitNowQrPayload({
      merchantId: 'SANDBOX',
      billRef: 'abc123',
      amount: '100.00',
      currency: 'MYR',
    });
    const payload = finalizeEmvQrPayload(base);
    expect(payload).toContain('100.00');
    expect(payload).toContain('abc123');
    expect(payload).toMatch(/6304[A-F0-9]{4}$/);
  });
});

describe('DuitNowAdapter.verifyWebhook', () => {
  function signedBody(status: string) {
    const body = {
      billRef: 'payref1',
      endToEndId: 'E2E1',
      amount: '100.00',
      currency: 'MYR',
      status,
    };
    return { ...body, signature: duitnowWebhookSignature(body, credentials.webhookSecret) };
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

  it('reports failed status without throwing', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: signedBody('FAILED'),
      credentials,
    });
    expect(verified).toMatchObject({ providerRef: 'payref1', succeeded: false });
  });

  it('rejects a tampered signature', async () => {
    const body = { ...signedBody('SUCCESS'), signature: 'bad' };
    const verified = await adapter.verifyWebhook({ payload: '', headers: {}, body, credentials });
    expect(verified).toBeNull();
  });

  it('accepts sandbox settle without webhook secret', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: { billRef: 'payref1', status: 'SUCCESS', sandbox: true },
      credentials: {},
    });
    expect(verified).toMatchObject({ providerRef: 'payref1', succeeded: true });
  });
});

describe('duitnowWebhookSignature', () => {
  it('is deterministic for the same payload', () => {
    const body = {
      billRef: 'r1',
      endToEndId: 'e1',
      amount: '50.00',
      currency: 'MYR',
      status: 'SUCCESS',
    };
    const a = duitnowWebhookSignature(body, 'secret');
    const b = duitnowWebhookSignature(body, 'secret');
    expect(a).toBe(b);
    expect(a).toBe(createHmac('sha256', 'secret').update('r1|e1|50.00|MYR|SUCCESS').digest('hex'));
  });
});
