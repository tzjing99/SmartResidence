import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, PaymentProvider, PaymentStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';
import type { FpxAdapter } from './providers/fpx.adapter';
import type { StripeAdapter } from './providers/stripe.adapter';

const CONDO = 'condo-1';

function admin(): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'a@b.c',
    name: 'Admin',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function makeService(prisma: Partial<PrismaService>, events: { emit: ReturnType<typeof vi.fn> }) {
  const feeSchedule = {
    computeLinesForUnit: vi.fn(() => []),
    computeExtraLinesForUnit: vi.fn(() => []),
    listActiveExtraLinesForPeriod: vi.fn(async () => []),
  } as unknown as import('./fee-schedule.service').FeeScheduleService;
  const ledger = {
    recordInvoiceCharges: vi.fn(async () => {}),
    recordPaymentAllocation: vi.fn(async () => {}),
    getCredit: vi.fn(async () => 0),
    record: vi.fn(async () => {}),
    addCredit: vi.fn(async () => {}),
    consumeCredit: vi.fn(async () => {}),
    reverseInvoiceCharges: vi.fn(async () => {}),
  } as unknown as import('./ledger.service').LedgerService;
  const receipts = {
    issueInTx: vi.fn(async () => ({ id: 'rcpt-1' })),
  } as unknown as import('./receipt.service').ReceiptService;
  const gateways = {
    resolveCredentials: vi.fn(async () => null),
  } as unknown as import('./gateway-connection.service').GatewayConnectionService;
  return new BillingService(
    prisma as PrismaService,
    events as unknown as EventEmitter2,
    feeSchedule,
    ledger,
    receipts,
    gateways,
    {} as StripeAdapter,
    {} as FpxAdapter,
    {} as import('./providers/fiuu.adapter').FiuuAdapter,
    {} as import('./providers/ipay88.adapter').IPay88Adapter,
    {} as import('./providers/duitnow.adapter').DuitNowAdapter,
  );
}

function owner(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: 'unit-1', permissions: [] }],
  };
}

function txStub(overrides: Record<string, unknown> = {}) {
  return {
    payment: {
      create: vi.fn(async () => ({ id: 'pay-1' })),
      aggregate: vi.fn(async () => ({ _sum: { amount: 100 } })),
      findUnique: vi.fn(async () => ({ id: 'pay-1', amount: 100, paidAt: new Date() })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    invoice: {
      findUnique: vi.fn(async () => ({
        id: 'inv-1',
        condoId: CONDO,
        unitId: 'unit-1',
        total: 100,
        amountPaid: 0,
        status: InvoiceStatus.ISSUED,
      })),
      update: vi.fn(async () => ({})),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    ...overrides,
  };
}

describe('BillingService.recordManualPayment', () => {
  it('settles an invoice in full and emits invoice.paid', async () => {
    const tx = txStub();
    const invoice = {
      id: 'inv-1',
      condoId: CONDO,
      unitId: 'unit-1',
      total: 100,
      amountPaid: 0,
      status: InvoiceStatus.ISSUED,
      currencyCode: 'MYR',
      metadata: {},
    };
    const prisma = {
      invoice: { findUnique: vi.fn(async () => invoice) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const events = { emit: vi.fn() };
    const svc = makeService(prisma, events);

    await svc.recordManualPayment(admin(), 'inv-1', { method: 'CASH' });

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED, amount: 100 }),
      }),
    );
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
    );
    expect(events.emit).toHaveBeenCalledWith('invoice.paid', { invoiceId: 'inv-1' });
  });

  it('rejects a payment that exceeds the outstanding balance', async () => {
    const invoice = {
      id: 'inv-1',
      condoId: CONDO,
      unitId: 'unit-1',
      total: 100,
      amountPaid: 80,
      status: InvoiceStatus.PARTIAL,
      currencyCode: 'MYR',
      metadata: {},
    };
    const prisma = {
      invoice: { findUnique: vi.fn(async () => invoice) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });

    await expect(svc.recordManualPayment(admin(), 'inv-1', { amount: 50 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects payment on a voided invoice', async () => {
    const invoice = {
      id: 'inv-1',
      condoId: CONDO,
      unitId: 'unit-1',
      total: 100,
      amountPaid: 0,
      status: InvoiceStatus.VOID,
      currencyCode: 'MYR',
      metadata: {},
    };
    const prisma = {
      invoice: { findUnique: vi.fn(async () => invoice) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });

    await expect(svc.recordManualPayment(admin(), 'inv-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('BillingService.markPaymentSucceeded', () => {
  it('is idempotent: a payment already SUCCEEDED is not re-settled', async () => {
    const transaction = vi.fn();
    const prisma = {
      payment: {
        findFirst: vi.fn(async () => ({
          id: 'pay-1',
          invoiceId: 'inv-1',
          status: PaymentStatus.SUCCEEDED,
        })),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    const events = { emit: vi.fn() };
    const svc = makeService(prisma, events);

    const res = await svc.markPaymentSucceeded('ref-1');

    expect(res).toMatchObject({ id: 'pay-1', status: PaymentStatus.SUCCEEDED });
    expect(transaction).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('BillingService.listPaymentIssues', () => {
  it('does not duplicate block prefixes in unit labels', async () => {
    const prisma = {
      payment: {
        findMany: vi.fn(async () => [
          {
            id: 'pay-1',
            invoiceId: 'inv-1',
            invoice: {
              number: 'INV-1',
              unit: { identifier: 'A-04-3', block: { name: 'A' } },
            },
            amount: 100,
            currencyCode: 'MYR',
            status: PaymentStatus.FAILED,
            provider: 'STRIPE',
            providerRef: 'ref-1',
            createdAt: new Date('2026-06-30T00:00:00.000Z'),
            metadata: {},
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });

    const res = await svc.listPaymentIssues(admin(), CONDO);

    expect(res[0]?.unitIdentifier).toBe('A-04-3');
  });
});

describe('BillingService.handleGatewayCallback', () => {
  it('marks a verified non-success gateway callback as FAILED', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const findUnique = vi.fn(async () => ({ id: 'pay-1', status: PaymentStatus.FAILED }));
    const prisma = {
      payment: {
        findFirst: vi.fn(async () => ({
          id: 'pay-1',
          invoiceId: 'inv-1',
          status: PaymentStatus.PENDING,
          metadata: {},
          invoice: { condoId: CONDO },
        })),
        updateMany,
        findUnique,
      },
    } as unknown as PrismaService;
    const fiuu = {
      verifyWebhook: vi.fn(async () => ({ providerRef: 'order-1', succeeded: false, raw: {} })),
    };
    const svc = makeService(prisma, { emit: vi.fn() });
    (svc as unknown as { providers: Map<unknown, unknown> }).providers.set('RAZER' as never, fiuu);
    const gateways = (
      svc as unknown as { gateways: { resolveCredentials: ReturnType<typeof vi.fn> } }
    ).gateways;
    gateways.resolveCredentials = vi.fn(async () => ({
      credentials: { secretKey: 'sk' },
      mode: 'TEST',
      publicConfig: {},
    }));

    await svc.handleGatewayCallback('RAZER' as never, { orderid: 'order-1', status: '11' }, {});

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
  });
});

describe('BillingService.voidInvoice', () => {
  it('refuses to void a fully paid invoice', async () => {
    const prisma = {
      invoice: {
        findUnique: vi.fn(async () => ({
          id: 'inv-1',
          condoId: CONDO,
          unitId: 'unit-1',
          status: InvoiceStatus.PAID,
          metadata: {},
        })),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });

    await expect(svc.voidInvoice(admin(), 'inv-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('voids an unpaid invoice with ledger reversal and pending payment cancellation', async () => {
    const invoice = {
      id: 'inv-1',
      number: 'INV-1',
      condoId: CONDO,
      unitId: 'unit-1',
      status: InvoiceStatus.ISSUED,
      amountPaid: 0,
      metadata: {},
    };
    const tx = {
      payment: { updateMany: vi.fn(async () => ({ count: 1 })) },
      invoice: { update: vi.fn(async () => ({})) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      invoice: { findUnique: vi.fn(async () => invoice) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });
    const ledger = svc as unknown as {
      ledger: { reverseInvoiceCharges: ReturnType<typeof vi.fn> };
    };

    await svc.voidInvoice(admin(), 'inv-1', 'Duplicate cycle');

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PaymentStatus.CANCELLED } }),
    );
    expect(ledger.ledger.reverseInvoiceCharges).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 'inv-1', number: 'INV-1' }),
      'admin-1',
      'Duplicate cycle',
    );
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.VOID }) }),
    );
  });
});

describe('BillingService.generateRecurring', () => {
  it('skips units that already have an invoice for the period', async () => {
    const units = [{ id: 'unit-1' }, { id: 'unit-2' }];
    const count = vi
      .fn()
      .mockResolvedValueOnce(1) // unit-1 already billed
      .mockResolvedValueOnce(0); // unit-2 not billed
    const create = vi.fn(async () => ({ id: 'inv-new', issuedAt: new Date() }));
    const tx = {
      invoice: { create, findMany: vi.fn(async () => []) },
      billingNumberSequence: {
        upsert: vi.fn(async () => ({ lastNumber: 1 })),
        update: vi.fn(async () => ({ lastNumber: 1 })),
      },
    };
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: CONDO })) },
      unit: { findMany: vi.fn(async () => units) },
      invoice: { count, findMany: vi.fn(async () => [{ unitId: 'unit-1' }]) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const events = { emit: vi.fn() };
    const svc = makeService(prisma, events);

    const res = await svc.generateRecurring(admin(), CONDO, {
      periodStart: new Date('2026-06-01'),
      periodEnd: new Date('2026-06-30'),
      dueDate: new Date('2026-06-15'),
      lines: [{ code: 'MAINT', description: 'Maintenance', unitPrice: 250, quantity: 1 }],
    });

    expect(res).toEqual({ created: 1, skipped: 1, skippedNoRate: 0, units: 2 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('invoice.issued', { invoiceId: 'inv-new' });
  });

  it('adds active extra fee schedule lines during scheduled generation', async () => {
    const units = [
      {
        id: 'unit-1',
        sqft: 1000,
        unitTypeId: 'type-a',
        unitType: { id: 'type-a', name: 'Type A' },
      },
    ];
    const create = vi.fn(async () => ({ id: 'inv-new', issuedAt: new Date() }));
    const tx = {
      invoice: { create, findMany: vi.fn(async () => []) },
      billingNumberSequence: {
        upsert: vi.fn(async () => ({ lastNumber: 1 })),
        update: vi.fn(async () => ({ lastNumber: 1 })),
      },
    };
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: CONDO })) },
      unit: { findMany: vi.fn(async () => units) },
      invoice: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });
    const feeSchedule = svc as unknown as {
      feeSchedule: {
        computeLinesForUnit: ReturnType<typeof vi.fn>;
        computeExtraLinesForUnit: ReturnType<typeof vi.fn>;
        listActiveExtraLinesForPeriod: ReturnType<typeof vi.fn>;
      };
    };
    const extraLines = [
      {
        code: 'FIRE',
        description: 'Fire insurance premium',
        rateType: 'FLAT',
        amount: 25,
        unitTypeAmounts: {},
      },
    ];
    feeSchedule.feeSchedule.listActiveExtraLinesForPeriod.mockResolvedValue(extraLines);
    feeSchedule.feeSchedule.computeLinesForUnit.mockReturnValue([
      { code: 'MAINT', description: 'Maintenance', unitPrice: 100, quantity: 1, fund: 'MAINTENANCE' },
    ]);
    feeSchedule.feeSchedule.computeExtraLinesForUnit.mockReturnValue([
      {
        code: 'FIRE',
        description: 'Fire insurance premium',
        unitPrice: 25,
        quantity: 1,
        fund: 'SINKING_FUND',
      },
    ]);

    const res = await svc.generateRecurring(admin(), CONDO, {
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-07-31'),
      dueDate: new Date('2026-07-15'),
    });

    expect(res.created).toBe(1);
    expect(feeSchedule.feeSchedule.listActiveExtraLinesForPeriod).toHaveBeenCalledWith(
      CONDO,
      new Date('2026-07-01'),
      new Date('2026-07-31'),
    );
    expect(feeSchedule.feeSchedule.computeExtraLinesForUnit).toHaveBeenCalledWith(
      units[0],
      extraLines,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 125,
          total: 125,
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ code: 'MAINT', amount: 100 }),
              expect.objectContaining({ code: 'FIRE', amount: 25 }),
            ]),
          },
        }),
      }),
    );
  });
});

describe('BillingService.createPayment', () => {
  it('cancels stale pending payments before creating a new gateway attempt', async () => {
    const invoice = {
      id: 'inv-1',
      condoId: CONDO,
      unitId: 'unit-1',
      total: 100,
      amountPaid: 0,
      status: InvoiceStatus.ISSUED,
      currencyCode: 'MYR',
      metadata: {},
    };
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const paymentCreate = vi.fn(async () => ({ id: 'pay-new', amount: 100 }));
    const paymentUpdate = vi.fn(async () => ({}));
    const prisma = {
      invoice: { findUnique: vi.fn(async () => invoice) },
      payment: { updateMany, create: paymentCreate, update: paymentUpdate },
    } as unknown as PrismaService;
    const svc = makeService(prisma, { emit: vi.fn() });
    const gateways = svc as unknown as {
      gateways: { resolveCredentials: ReturnType<typeof vi.fn> };
    };
    gateways.gateways.resolveCredentials = vi.fn(async () => ({
      credentials: { secretKey: 'sk' },
      mode: 'TEST',
      publicConfig: {},
    }));
    const duitnow = {
      createIntent: vi.fn(async () => ({ providerRef: 'ref-1', redirectUrl: null })),
    };
    (svc as unknown as { providers: Map<unknown, unknown> }).providers.set(
      PaymentProvider.DUITNOW_QR,
      duitnow,
    );

    await svc.createPayment(owner(), 'inv-1', { provider: PaymentProvider.DUITNOW_QR });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: 'inv-1', status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CANCELLED },
      }),
    );
    expect(paymentCreate).toHaveBeenCalled();
    expect(duitnow.createIntent).toHaveBeenCalled();
  });
});

describe('BillingService.runDueSweep', () => {
  it('flags overdue invoices and emits reminders', async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'over-1' }, { id: 'over-2' }]) // overdue candidates
      .mockResolvedValueOnce([{ id: 'soon-1', metadata: {} }]); // due soon
    const update = vi.fn(async () => ({}));
    const prisma = {
      invoice: { findMany, updateMany, update },
    } as unknown as PrismaService;
    const events = { emit: vi.fn() };
    const svc = makeService(prisma, events);

    const res = await svc.runDueSweep(admin(), CONDO);

    expect(res.overdue).toBe(2);
    expect(res.dueSoonNotified).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: InvoiceStatus.OVERDUE } }),
    );
    expect(events.emit).toHaveBeenCalledWith('invoice.overdue', { invoiceId: 'over-1' });
    expect(events.emit).toHaveBeenCalledWith('invoice.due_soon', { invoiceId: 'soon-1' });
  });
});
