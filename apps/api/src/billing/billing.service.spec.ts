import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, PaymentStatus, RoleId } from '@prisma/client';
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
  return new BillingService(
    prisma as PrismaService,
    events as unknown as EventEmitter2,
    {} as StripeAdapter,
    {} as FpxAdapter,
  );
}

function txStub(overrides: Record<string, unknown> = {}) {
  return {
    payment: {
      create: vi.fn(async () => ({ id: 'pay-1' })),
      aggregate: vi.fn(async () => ({ _sum: { amount: 100 } })),
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
});

describe('BillingService.generateRecurring', () => {
  it('skips units that already have an invoice for the period', async () => {
    const units = [{ id: 'unit-1' }, { id: 'unit-2' }];
    const count = vi
      .fn()
      .mockResolvedValueOnce(1) // unit-1 already billed
      .mockResolvedValueOnce(0); // unit-2 not billed
    const create = vi.fn(async () => ({ id: 'inv-new' }));
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: CONDO })) },
      unit: { findMany: vi.fn(async () => units) },
      invoice: { count, create },
    } as unknown as PrismaService;
    const events = { emit: vi.fn() };
    const svc = makeService(prisma, events);

    const res = await svc.generateRecurring(admin(), CONDO, {
      periodStart: new Date('2026-06-01'),
      periodEnd: new Date('2026-06-30'),
      dueDate: new Date('2026-06-15'),
      lines: [{ code: 'MAINT', description: 'Maintenance', unitPrice: 250, quantity: 1 }],
    });

    expect(res).toEqual({ created: 1, skipped: 1, units: 2 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('invoice.issued', { invoiceId: 'inv-new' });
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

    const res = await svc.runDueSweep(CONDO);

    expect(res.overdue).toBe(2);
    expect(res.dueSoonNotified).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: InvoiceStatus.OVERDUE } }),
    );
    expect(events.emit).toHaveBeenCalledWith('invoice.overdue', { invoiceId: 'over-1' });
    expect(events.emit).toHaveBeenCalledWith('invoice.due_soon', { invoiceId: 'soon-1' });
  });
});
