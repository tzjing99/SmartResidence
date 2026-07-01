import { describe, expect, it, vi } from 'vitest';
import { parseBankCsv } from './bank-reconciliation.service';
import { MALAYSIAN_JMB_COA } from './coa-template';
import { journalBalanced } from './coa.service';

describe('journalBalanced', () => {
  it('returns true when debits equal credits', () => {
    expect(
      journalBalanced([
        { debit: 100, credit: 0 },
        { debit: 50, credit: 0 },
        { debit: 0, credit: 150 },
      ]),
    ).toBe(true);
  });

  it('returns false when out of balance', () => {
    expect(
      journalBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 99 },
      ]),
    ).toBe(false);
  });
});

describe('MALAYSIAN_JMB_COA', () => {
  it('seeds maintenance and sinking fund bank accounts separately', () => {
    const maint = MALAYSIAN_JMB_COA.find((a) => a.code === '1000');
    const sink = MALAYSIAN_JMB_COA.find((a) => a.code === '1010');
    expect(maint?.fund).toBe('MAINTENANCE');
    expect(sink?.fund).toBe('SINKING_FUND');
  });

  it('has unique account codes', () => {
    const codes = MALAYSIAN_JMB_COA.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('parseBankCsv', () => {
  it('parses date, description, amount rows', () => {
    const csv = `date,description,amount
2026-06-01,FPX payment,150.00
02/06/2026,Transfer out,-50.00`;
    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.description).toBe('FPX payment');
    expect(rows[0]?.amount).toBe(150);
    expect(rows[1]?.amount).toBe(-50);
  });
});

describe('GlService.postEntry balance check', () => {
  it('rejects unbalanced manual entries', async () => {
    const coa = {
      ensureSeeded: vi.fn(async () => {}),
    };
    const prisma = {
      glJournalEntry: { findUnique: vi.fn(async () => null) },
    };
    const { GlService } = await import('./gl.service');
    const svc = new GlService(prisma as never, coa as never);
    await expect(
      svc.postEntry(prisma as never, {
        condoId: 'c1',
        entryDate: new Date('2026-06-01'),
        description: 'Test',
        sourceType: 'MANUAL',
        lines: [
          { accountId: 'a1', debit: 100, credit: 0, fund: 'MAINTENANCE' },
          { accountId: 'a2', debit: 0, credit: 50, fund: 'MAINTENANCE' },
        ],
      }),
    ).rejects.toThrow(/Debits must equal credits/);
  });
});

describe('CoaService.ensureSeeded fund separation', () => {
  it('creates distinct income accounts per fund', async () => {
    const created: Array<{ code: string; fund: string }> = [];
    const client = {
      glAccount: {
        count: vi.fn(async () => 0),
        create: vi.fn(async ({ data }: { data: { code: string; fund: string } }) => {
          created.push({ code: data.code, fund: data.fund });
          return { id: data.code, ...data };
        }),
      },
    };
    const { CoaService } = await import('./coa.service');
    const svc = new CoaService({} as never);
    await svc.ensureSeeded(client as never, 'condo-1');

    const maintIncome = created.find((a) => a.code === '4000');
    const sinkIncome = created.find((a) => a.code === '4010');
    expect(maintIncome?.fund).toBe('MAINTENANCE');
    expect(sinkIncome?.fund).toBe('SINKING_FUND');
    expect(created.length).toBe(MALAYSIAN_JMB_COA.length);
  });

  it('is idempotent when accounts already exist', async () => {
    const client = {
      glAccount: {
        count: vi.fn(async () => 5),
        create: vi.fn(),
      },
    };
    const { CoaService } = await import('./coa.service');
    const svc = new CoaService({} as never);
    await svc.ensureSeeded(client as never, 'condo-1');
    expect(client.glAccount.create).not.toHaveBeenCalled();
  });
});
