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
