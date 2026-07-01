import type { PrismaService } from '@/prisma/prisma.service';
import { describe, expect, it, vi } from 'vitest';
import { LedgerService } from './ledger.service';

describe('LedgerService.fundOfCode', () => {
  it('maps line codes to accounting funds', () => {
    expect(LedgerService.fundOfCode('MAINT')).toBe('MAINTENANCE');
    expect(LedgerService.fundOfCode('SINKING')).toBe('SINKING_FUND');
    expect(LedgerService.fundOfCode('GARBAGE')).toBe('GENERAL');
  });
});

describe('LedgerService.recordPaymentAllocation', () => {
  it('allocates a payment across funds proportional to the invoice lines', async () => {
    const created: Array<{ fund: string; amount: number }> = [];
    const tx = {
      invoice: {
        findUnique: vi.fn(async () => ({
          id: 'inv',
          condoId: 'c',
          unitId: 'u',
          number: 'INV-1',
          lines: [
            { code: 'MAINT', amount: 300 },
            { code: 'SINKING', amount: 100 },
          ],
        })),
      },
      ledgerEntry: {
        create: vi.fn(async ({ data }: { data: { fund: string; amount: number } }) => {
          created.push(data);
          return data;
        }),
        createMany: vi.fn(async ({ data }: { data: Array<{ fund: string; amount: number }> }) => {
          created.push(...data);
          return { count: data.length };
        }),
        upsert: vi.fn(async ({ create }: { create: { fund: string; amount: number } }) => {
          created.push(create);
          return create;
        }),
      },
    };
    const svc = new LedgerService({} as PrismaService);

    await svc.recordPaymentAllocation(tx as never, {
      invoiceId: 'inv',
      paymentId: 'p',
      amount: 200,
    });

    const maint = created.find((e) => e.fund === 'MAINTENANCE');
    const sink = created.find((e) => e.fund === 'SINKING_FUND');
    expect(maint?.amount).toBeCloseTo(150);
    expect(sink?.amount).toBeCloseTo(50);
    expect(created.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(200);
  });
});

describe('LedgerService.unitStatementInRange', () => {
  it('computes opening balance and filters entries to the date range', async () => {
    const day = 86_400_000;
    const base = new Date('2026-01-15T12:00:00Z').getTime();
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async () => [
          {
            type: 'CHARGE',
            amount: 100,
            fund: 'MAINTENANCE',
            memo: 'Jan invoice',
            occurredAt: new Date(base - 20 * day),
          },
          {
            type: 'PAYMENT',
            amount: 40,
            fund: 'MAINTENANCE',
            memo: 'Partial pay',
            occurredAt: new Date(base - 5 * day),
          },
          {
            type: 'PAYMENT',
            amount: 60,
            fund: 'MAINTENANCE',
            memo: 'Final pay',
            occurredAt: new Date(base + 2 * day),
          },
        ]),
      },
      unitAccount: {
        findUnique: vi.fn(async () => ({ creditBalance: 25 })),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const from = new Date(base - 10 * day);
    const to = new Date(base + 10 * day);
    const res = await svc.unitStatementInRange('u', from, to);

    expect(res.openingBalance).toBeCloseTo(100);
    expect(res.entries).toHaveLength(2);
    expect(res.entries[0]?.description).toBe('Partial pay');
    expect(res.closingBalance).toBeCloseTo(0);
    expect(res.creditBalance).toBe(25);
  });
});

describe('LedgerService.arrearsExportRows', () => {
  it('returns per-invoice arrears detail skipping settled invoices', async () => {
    const now = Date.now();
    const day = 86_400_000;
    const prisma = {
      invoice: {
        findMany: vi.fn(async () => [
          {
            number: 'INV-1',
            total: 100,
            amountPaid: 0,
            dueDate: new Date(now - 10 * day),
            unit: { identifier: 'A-01-1', block: { name: 'A' } },
          },
          {
            number: 'INV-2',
            total: 50,
            amountPaid: 50,
            dueDate: new Date(now - 40 * day),
            unit: { identifier: 'A-01-2', block: { name: 'A' } },
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const rows = await svc.arrearsExportRows('c');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.invoiceNumber).toBe('INV-1');
    expect(rows[0]?.bucket).toBe('0-30');
    expect(rows[0]?.outstanding).toBeCloseTo(100);
  });
});

describe('LedgerService.recordInvoiceCharges', () => {
  it('posts invoice lines to maintenance vs sinking funds by line code', async () => {
    const created: Array<{ fund: string; amount: number; type: string }> = [];
    const tx = {
      ledgerEntry: {
        createMany: vi.fn(
          async ({ data }: { data: Array<{ fund: string; amount: number; type: string }> }) => {
            created.push(...data);
            return { count: data.length };
          },
        ),
      },
    };
    const svc = new LedgerService({} as PrismaService);

    await svc.recordInvoiceCharges(tx as never, { id: 'inv-1', condoId: 'c', unitId: 'u' }, [
      { code: 'MAINT', amount: 300, description: 'Maintenance' },
      { code: 'SINKING', amount: 50, description: 'Sinking fund' },
    ]);

    expect(created).toHaveLength(2);
    expect(created.find((e) => e.fund === 'MAINTENANCE')?.amount).toBe(300);
    expect(created.find((e) => e.fund === 'SINKING_FUND')?.amount).toBe(50);
  });
});

describe('LedgerService.fundSummary', () => {
  it('keeps maintenance and sinking fund balances separate and excludes charges from cash', async () => {
    const day = 86_400_000;
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async () => [
          {
            fund: 'MAINTENANCE',
            type: 'CHARGE',
            amount: 500,
            occurredAt: new Date(from.getTime() + 5 * day),
          },
          {
            fund: 'SINKING_FUND',
            type: 'CHARGE',
            amount: 100,
            occurredAt: new Date(from.getTime() + 5 * day),
          },
          {
            fund: 'MAINTENANCE',
            type: 'PAYMENT',
            amount: 400,
            occurredAt: new Date(from.getTime() + 10 * day),
          },
          {
            fund: 'SINKING_FUND',
            type: 'PAYMENT',
            amount: 100,
            occurredAt: new Date(from.getTime() + 10 * day),
          },
          {
            fund: 'DEPOSIT',
            type: 'DEPOSIT',
            amount: 1000,
            occurredAt: new Date(from.getTime() + 12 * day),
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const report = await svc.fundSummary('c', from, to);

    const maint = report.funds.find((f) => f.fund === 'MAINTENANCE');
    const sink = report.funds.find((f) => f.fund === 'SINKING_FUND');
    const deposit = report.funds.find((f) => f.fund === 'DEPOSIT');

    expect(maint?.chargesIssued).toBeCloseTo(500);
    expect(maint?.collections).toBeCloseTo(400);
    expect(maint?.closingBalance).toBeCloseTo(400);
    expect(sink?.closingBalance).toBeCloseTo(100);
    expect(deposit?.closingBalance).toBeCloseTo(1000);
    expect(maint?.closingBalance).not.toBe(sink?.closingBalance);
  });
});

describe('LedgerService.arrearsAging', () => {
  it('buckets outstanding invoices by age and skips paid ones', async () => {
    const now = Date.now();
    const day = 86_400_000;
    const prisma = {
      invoice: {
        findMany: vi.fn(async () => [
          { unitId: 'u1', total: 100, amountPaid: 0, dueDate: new Date(now - 10 * day) },
          { unitId: 'u1', total: 100, amountPaid: 100, dueDate: new Date(now - 50 * day) },
          { unitId: 'u2', total: 200, amountPaid: 50, dueDate: new Date(now - 100 * day) },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const res = await svc.arrearsAging('c');

    expect(res.unitsInArrears).toBe(2);
    expect(res.invoicesInArrears).toBe(2);
    expect(res.totalOutstanding).toBeCloseTo(250);
    expect(res.buckets.find((b) => b.bucket === '0-30')?.amount).toBeCloseTo(100);
    expect(res.buckets.find((b) => b.bucket === '90+')?.amount).toBeCloseTo(150);
  });
});
