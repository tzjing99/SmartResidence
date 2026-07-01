import { createHash } from 'node:crypto';
import type { Invoice, Payment } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { IPay88Adapter } from './ipay88.adapter';

const adapter = new IPay88Adapter();

const invoice = { id: 'inv-1', number: 'INV-1', currencyCode: 'MYR', condoId: 'c1' } as Invoice;
const payment = { id: 'pay-1', amount: 100 } as unknown as Payment;
const credentials = { merchantCode: 'M1', merchantKey: 'K1' };

const sig = (parts: string[]) => createHash('sha256').update(parts.join('')).digest('base64');

describe('IPay88Adapter', () => {
  it('builds a signed form post to the sandbox entry', async () => {
    const res = await adapter.createIntent({ invoice, payment, credentials, mode: 'TEST' });
    expect(res.formPost?.url).toContain('sandbox.ipay88');
    expect(res.formPost?.fields.RefNo).toBe('pay-1');
    expect(res.formPost?.fields.Signature).toBeTruthy();
    expect(res.providerRef).toBe('pay-1');
  });

  it('verifies a correctly-signed success callback', async () => {
    const body = {
      MerchantCode: 'M1',
      PaymentId: '2',
      RefNo: 'pay-1',
      Amount: '100.00',
      Currency: 'MYR',
      Status: '1',
    };
    const signature = sig(['K1', 'M1', '2', 'pay-1', '10000', 'MYR', '1']);
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: { ...body, Signature: signature },
      credentials,
    });
    expect(verified).toMatchObject({ providerRef: 'pay-1', succeeded: true });
  });

  it('rejects a tampered signature', async () => {
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers: {},
      body: {
        MerchantCode: 'M1',
        RefNo: 'pay-1',
        Amount: '100.00',
        Currency: 'MYR',
        Status: '1',
        Signature: 'bad',
      },
      credentials,
    });
    expect(verified).toBeNull();
  });
});
