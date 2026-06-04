import { describe, expect, it, vi } from 'vitest';
import { BillingService } from '../src/billing/billing.service';

function makeService() {
  const prisma: any = {
    invoice: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
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
  const service = new BillingService(prisma, [stripe, fpx], events);
  return { service, prisma, stripe, fpx, events };
}

describe('BillingService', () => {
  it('starts a Stripe payment intent for an open invoice', async () => {
    const { service, prisma, stripe } = makeService();
    prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'i1',
      status: 'OPEN',
      totalCents: 25000,
      currency: 'MYR',
    });
    prisma.payment.create.mockResolvedValueOnce({ id: 'p1' });

    const out = await service.startPayment({
      invoiceId: 'i1',
      provider: 'STRIPE',
      actorUserId: 'u1',
    });
    expect(out.clientSecret).toBe('cs_x');
    expect(stripe.createIntent).toHaveBeenCalledOnce();
  });

  it('rejects an unknown payment provider', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'i1',
      status: 'OPEN',
      totalCents: 1000,
      currency: 'MYR',
    });
    await expect(
      service.startPayment({ invoiceId: 'i1', provider: 'NOT_REAL' as any, actorUserId: 'u1' }),
    ).rejects.toThrow();
  });

  it('refuses to take a payment on a paid invoice', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'i1',
      status: 'PAID',
      totalCents: 1000,
      currency: 'MYR',
    });
    await expect(
      service.startPayment({ invoiceId: 'i1', provider: 'STRIPE', actorUserId: 'u1' }),
    ).rejects.toThrow();
  });
});
