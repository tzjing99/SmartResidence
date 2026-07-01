import type { PrismaService } from '@/prisma/prisma.service';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { buildBalanceSheetPdf } from './balance-sheet-pdf';
import { LedgerService } from './ledger.service';
import { buildProfitLossPdf } from './profit-loss-pdf';

describe('LedgerService financial statements', () => {
  const from = new Date('2026-03-01T00:00:00.000Z');
  const to = new Date('2026-03-31T23:59:59.999Z');
  const asOf = new Date('2026-03-31T23:59:59.999Z');

  it('builds profit & loss with income from collections and expenditure from charges', async () => {
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async (args: { where?: { type?: { in?: string[] } } }) => {
          if (args.where?.type?.in) {
            return [
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
                amount: 280,
                sourceType: 'Payment',
                sourceId: 'pay-1',
                memo: 'Payment for INV-1',
              },
            ];
          }
          return [{ fund: 'MAINTENANCE', amount: 20, memo: 'Interest received' }];
        }),
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

    const report = await svc.profitLoss('c', from, to);

    expect(report.income.total).toBeCloseTo(300);
    expect(report.expenses.total).toBeCloseTo(350);
    expect(report.netSurplus).toBeCloseTo(-50);
    expect(report.income.lines.some((l) => l.label.includes('Payment for INV-1'))).toBe(true);
    expect(report.expenses.lines.some((l) => l.code === 'SINKING')).toBe(true);
    expect(report.income.lines.some((l) => l.label.includes('Other income'))).toBe(true);
  });

  it('filters profit & loss to a single fund', async () => {
    const prisma = {
      ledgerEntry: {
        findMany: vi.fn(async (args: { where?: { type?: { in?: string[] } } }) => {
          if (args.where?.type?.in) {
            return [
              {
                fund: 'MAINTENANCE',
                type: 'PAYMENT',
                amount: 100,
                sourceType: 'Payment',
                sourceId: 'p1',
                memo: 'Maintenance payment',
              },
              {
                fund: 'SINKING_FUND',
                type: 'PAYMENT',
                amount: 40,
                sourceType: 'Payment',
                sourceId: 'p2',
                memo: 'Sinking payment',
              },
            ];
          }
          return [];
        }),
      },
      invoiceLine: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const report = await svc.profitLoss('c', from, to, 'SINKING_FUND');

    expect(report.fund).toBe('SINKING_FUND');
    expect(report.fundLabel).toBe('Sinking fund');
    expect(report.income.total).toBeCloseTo(40);
    expect(report.expenses.total).toBeCloseTo(0);
  });

  it('builds balance sheet with receivables, deposits liability, and fund equity', async () => {
    const prisma = {
      ledgerEntry: {
        groupBy: vi.fn(async () => [
          { fund: 'MAINTENANCE', _sum: { amount: 12000 } },
          { fund: 'SINKING_FUND', _sum: { amount: 4500 } },
          { fund: 'DEPOSIT', _sum: { amount: 800 } },
        ]),
      },
      invoice: {
        findMany: vi.fn(async () => [
          {
            total: 500,
            payments: [{ amount: 100 }],
          },
        ]),
      },
      unitAccount: {
        aggregate: vi.fn(async () => ({ _sum: { creditBalance: 50 } })),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const report = await svc.balanceSheet('c', asOf);

    expect(report.assets.lines.some((l) => l.label.includes('receivables'))).toBe(true);
    expect(report.assets.lines.some((l) => l.label.includes('Deposits held'))).toBe(true);
    expect(report.liabilities.lines.some((l) => l.label === 'Deposits held')).toBe(true);
    expect(report.funds.lines.some((l) => l.label === 'Maintenance fund')).toBe(true);
    expect(report.funds.lines.some((l) => l.label === 'Sinking fund')).toBe(true);
    expect(report.funds.total).toBeCloseTo(16500);
    expect(report.assets.lines.find((l) => l.label.includes('receivables'))?.amount).toBeCloseTo(
      400,
    );
  });

  it('computes receivables from succeeded payments on or before asOf', async () => {
    const prisma = {
      ledgerEntry: { groupBy: vi.fn(async () => []) },
      invoice: {
        findMany: vi.fn(async (args: { where: { issuedAt: { lte: Date } } }) => {
          expect(args.where.issuedAt.lte).toEqual(asOf);
          return [
            {
              total: 200,
              status: InvoiceStatus.PARTIAL,
              payments: [{ amount: 75, status: PaymentStatus.SUCCEEDED, paidAt: asOf }],
            },
          ];
        }),
      },
      unitAccount: {
        aggregate: vi.fn(async () => ({ _sum: { creditBalance: 0 } })),
      },
    } as unknown as PrismaService;
    const svc = new LedgerService(prisma);

    const receivables = await svc.receivablesAsOf('c', asOf);
    expect(receivables).toBeCloseTo(125);
  });

  it('renders profit & loss PDF with auditor signatory placeholder', () => {
    const buffer = buildProfitLossPdf({
      organizationName: 'Test Condo JMB',
      registrationNo: 'JMB-123',
      report: {
        from: from.toISOString(),
        to: to.toISOString(),
        fund: 'ALL',
        fundLabel: 'All funds',
        income: {
          title: 'Income',
          lines: [{ label: 'Monthly maintenance fee', code: 'MAINT', amount: 280 }],
          total: 280,
        },
        expenses: {
          title: 'Expenditure',
          lines: [{ label: 'Monthly maintenance fee', code: 'MAINT', amount: 300 }],
          total: 300,
        },
        netSurplus: -20,
      },
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('renders balance sheet PDF with fund labels', () => {
    const buffer = buildBalanceSheetPdf({
      organizationName: 'Test Condo JMB',
      report: {
        asOf: asOf.toISOString(),
        assets: {
          title: 'Assets',
          lines: [{ label: 'Amount due from proprietors (receivables)', amount: 400 }],
          total: 400,
        },
        liabilities: {
          title: 'Liabilities',
          lines: [{ label: 'Deposits held', amount: 800 }],
          total: 800,
        },
        funds: {
          title: 'Funds',
          lines: [
            { label: 'Maintenance fund', amount: 12000 },
            { label: 'Sinking fund', amount: 4500 },
          ],
          total: 16500,
        },
        totalAssets: 400,
        totalLiabilitiesAndFunds: 17300,
      },
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
