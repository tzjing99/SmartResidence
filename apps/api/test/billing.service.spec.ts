import { RoleId } from '@prisma/client';
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
      updateMany: vi.fn(async () => ({ count: 0 })),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  const stripe: any = {
    id: 'STRIPE',
    createIntent: vi.fn(async () => ({ providerRef: 'pi_x', clientSecret: 'cs_x' })),
    verifyWebhook: vi.fn(),
  };
  const fpx: any = {
    id: 'FPX',
    createIntent: vi.fn(async () => ({ providerRef: 'fpx_x', redirectUrl: 'https://gw.test' })),
    verifyWebhook: vi.fn(),
  };
  const fiuu: any = { id: 'RAZER', createIntent: vi.fn(), verifyWebhook: vi.fn() };
  const ipay88: any = { id: 'IPAY88', createIntent: vi.fn(), verifyWebhook: vi.fn() };
  const feeSchedule: any = { computeLinesForUnit: vi.fn(() => []) };
  const ledger: any = {
    recordInvoiceCharges: vi.fn(),
    recordPaymentAllocation: vi.fn(),
    getCredit: vi.fn(async () => 0),
    record: vi.fn(),
  };
  const receipts: any = { issueInTx: vi.fn(async () => ({ id: 'rcpt-x' })) };
  const gateways: any = { resolveCredentials: vi.fn(async () => null) };
  const events: any = { emit: vi.fn() };
  const service = new BillingService(
    prisma,
    events,
    feeSchedule,
    ledger,
    receipts,
    gateways,
    stripe,
    fpx,
    fiuu,
    ipay88,
  );
  return { service, prisma, stripe, fpx, gateways, events };
}

const actor: any = {
  id: 'u1',
  roles: [{ roleId: RoleId.UNIT_OWNER, condoId: 'c1', unitId: 'unit-1', permissions: [] }],
};

describe('BillingService', () => {
  it('starts a Stripe payment intent for an open invoice', async () => {
    const { service, prisma, stripe, gateways } = makeService();
    gateways.resolveCredentials.mockResolvedValueOnce({
      mode: 'TEST',
      credentials: { secretKey: 'sk_test' },
      publicConfig: {},
    });
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      condoId: 'c1',
      unitId: 'unit-1',
      status: 'ISSUED',
      total: 25000,
      amountPaid: 0,
      currencyCode: 'MYR',
    });
    prisma.payment.create.mockResolvedValueOnce({ id: 'p1' });
    prisma.payment.update.mockResolvedValueOnce({ id: 'p1', providerRef: 'pi_x' });

    const out = await service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any);
    expect(out.clientSecret).toBe('cs_x');
    expect(out.paymentId).toBe('p1');
    expect(stripe.createIntent).toHaveBeenCalledOnce();
  });

  it('rejects a provider with no enabled gateway connection', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      condoId: 'c1',
      unitId: 'unit-1',
      status: 'ISSUED',
      total: 1000,
      amountPaid: 0,
      currencyCode: 'MYR',
    });
    await expect(service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any)).rejects.toThrow(
      /not enabled/i,
    );
  });

  it('rejects payment attempts for another unit', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      condoId: 'c1',
      unitId: 'unit-2',
      status: 'ISSUED',
      total: 1000,
      amountPaid: 0,
      currencyCode: 'MYR',
    });

    await expect(service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any)).rejects.toThrow(
      /cannot access this invoice/i,
    );
  });

  it('rejects an unknown payment provider', async () => {
    const { service, prisma } = makeService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'i1',
      condoId: 'c1',
      unitId: 'unit-1',
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
      condoId: 'c1',
      unitId: 'unit-1',
      status: 'PAID',
      total: 1000,
      currencyCode: 'MYR',
    });
    await expect(
      service.createPayment(actor, 'i1', { provider: 'STRIPE' } as any),
    ).rejects.toThrow();
  });
});
