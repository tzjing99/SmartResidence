import { describe, expect, it, vi } from 'vitest';
import { BillingService } from '../src/billing/billing.service';

function makeService() {
  const prisma: any = {
    invoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  const stripe: any = {
    name: 'STRIPE',
    createIntent: vi.fn(async () => ({ providerRef: 'pi_x', clientSecret: 'cs_x' })),
    verifyWebhook: vi.fn(),
  };
  const fpx: any = {
    name: 'FPX',
    createIntent: vi.fn(async () => ({ providerRef: 'fpx_x', redirectUrl: 'https://gw.test' })),
    verifyWebhook: vi.fn(),
  };
  const events: any = { emit: vi.fn() };
  const service = new BillingService(prisma, events, stripe, fpx);
  return { service, prisma, stripe, fpx, events };
}

const actor: any = { id: 'u1' };

describe('BillingService', () => {
  it('starts a Stripe payment intent for an open invoice', async () => {
    const { service, prisma, stripe } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      status: 'ISSUED',
      total: 25000,
      currencyCode: 'MYR',
    });
    prisma.payment.create.mockResolvedValueOnce({ id: 'p1' });
    prisma.payment.update.mockResolvedValueOnce({ id: 'p1', providerRef: 'pi_x' });

    const out = await service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any);
    expect(out.clientSecret).toBe('cs_x');
    expect(out.paymentId).toBe('p1');
    expect(stripe.createIntent).toHaveBeenCalledOnce();
  });

  it('rejects an unknown payment provider', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      status: 'ISSUED',
      total: 1000,
      currencyCode: 'MYR',
    });
    await expect(
      service.createPayment(actor, 'i1', { provider: 'NOT_REAL' } as any),
    ).rejects.toThrow();
  });

  it('refuses to take a payment on a paid invoice', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      status: 'PAID',
      total: 1000,
      currencyCode: 'MYR',
    });
    await expect(
      service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any),
    ).rejects.toThrow();
  });
});
