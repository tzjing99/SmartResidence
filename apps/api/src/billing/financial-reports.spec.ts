import type { PrismaService } from '@/prisma/prisma.service';
import { describe, expect, it, vi } from 'vitest';
import { LedgerService } from './ledger.service';

describe('LedgerService financial report math', () => {
  it('computes prior-period opening balance for fund summary', async () => {
    const day = 86_400_000;
    const from = new Date('2026-02-01T00:00:00.000Z');
    const to = new Date('2026-02-28T23:59:59.999Z');
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async () => [
          {
            fund: 'MAINTENANCE',
            type: 'PAYMENT',
            amount: 200,
            occurredAt: new Date('2026-01-15T00:00:00.000Z'),
          },
          {
            fund: 'MAINTENANCE',
            type: 'PAYMENT',
            amount: 50,
            occurredAt: new Date(from.getTime() + 5 * day),
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const report = await svc.fundSummary('c', from, to);
    const maint = report.funds.find((f) => f.fund === 'MAINTENANCE');

    expect(maint?.openingBalance).toBeCloseTo(200);
    expect(maint?.collections).toBeCloseTo(50);
    expect(maint?.closingBalance).toBeCloseTo(250);
  });

  it('groups income and expense by fund without commingling', async () => {
    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-31T23:59:59.999Z');
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async () => [
          {
            fund: 'MAINTENANCE',
            type: 'CHARGE',
            amount: 300,
            sourceType: 'Invoice',
            sourceId: 'inv-1',
            memo: 'Maintenance fee',
          },
          {
            fund: 'SINKING_FUND',
            type: 'CHARGE',
            amount: 50,
            sourceType: 'Invoice',
            sourceId: 'inv-1',
            memo: 'Sinking fund',
          },
          {
            fund: 'MAINTENANCE',
            type: 'PAYMENT',
            amount: 300,
            sourceType: 'Payment',
            sourceId: 'pay-1',
            memo: 'Payment for INV-1',
          },
        ]),
      },
      invoiceLine: {
        findMany: vi.fn(async () => [
          {
            code: 'MAINT',
            description: 'Monthly maintenance fee',
            amount: 300,
            invoiceId: 'inv-1',
          },
          {
            code: 'SINKING',
            description: 'Sinking fund contribution',
            amount: 50,
            invoiceId: 'inv-1',
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const report = await svc.incomeExpense('c', from, to);

    expect(report.byFund.find((f) => f.fund === 'MAINTENANCE')?.charges).toBeCloseTo(300);
    expect(report.byFund.find((f) => f.fund === 'SINKING_FUND')?.charges).toBeCloseTo(50);
    expect(report.byCategory.some((c) => c.code === 'MAINT' && c.fund === 'MAINTENANCE')).toBe(
      true,
    );
    expect(report.byCategory.some((c) => c.code === 'SINKING' && c.fund === 'SINKING_FUND')).toBe(
      true,
    );
  });
});
