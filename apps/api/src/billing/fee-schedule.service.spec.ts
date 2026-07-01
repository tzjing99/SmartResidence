import type { PrismaService } from '@/prisma/prisma.service';
import { describe, expect, it, vi } from 'vitest';
import { FeeScheduleService } from './fee-schedule.service';

const svc = new FeeScheduleService({} as PrismaService);

describe('FeeScheduleService.computeLinesForUnit', () => {
  it('computes per-sqft maintenance + sinking-fund lines', () => {
    const lines = svc.computeLinesForUnit({
      sqft: 1000,
      unitType: {
        feeRate: {
          maintenanceRateType: 'PER_SQFT',
          maintenanceAmount: 0.3,
          sinkingFundRateType: 'PER_SQFT',
          sinkingFundAmount: 0.05,
        },
      },
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ code: 'MAINT', unitPrice: 300, quantity: 1 });
    expect(lines[1]).toMatchObject({ code: 'SINKING', unitPrice: 50, quantity: 1 });
  });

  it('uses flat amounts as-is and omits zero lines', () => {
    const lines = svc.computeLinesForUnit({
      sqft: 1000,
      unitType: {
        feeRate: {
          maintenanceRateType: 'FLAT',
          maintenanceAmount: 250,
          sinkingFundRateType: 'FLAT',
          sinkingFundAmount: 0,
        },
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ code: 'MAINT', unitPrice: 250 });
  });

  it('returns empty when there is no fee rate or unit type', () => {
    expect(svc.computeLinesForUnit({ sqft: 1000, unitType: { feeRate: null } })).toEqual([]);
    expect(svc.computeLinesForUnit({ sqft: 1000, unitType: null })).toEqual([]);
  });
});

describe('FeeScheduleService.computeExtraLinesForUnit', () => {
  it('computes flat and per-sqft extra fee lines with fund tags', () => {
    const lines = svc.computeExtraLinesForUnit(
      { sqft: 1000, unitTypeId: 'type-a', unitType: { id: 'type-a', name: 'Type A' } },
      [
        {
          code: 'FIRE',
          description: 'Fire insurance premium',
          fund: 'SINKING_FUND',
          rateType: 'FLAT',
          amount: 25,
          unitTypeAmounts: {},
        },
        {
          code: 'SEC',
          description: 'Security charge',
          fund: 'MAINTENANCE',
          rateType: 'PER_SQFT',
          amount: 0.02,
          unitTypeAmounts: {},
        },
      ],
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      code: 'FIRE',
      unitPrice: 25,
      quantity: 1,
      fund: 'SINKING_FUND',
    });
    expect(lines[1]).toMatchObject({
      code: 'SEC',
      unitPrice: 20,
      fund: 'MAINTENANCE',
    });
  });

  it('uses per-unit-type amounts and skips zero or missing amounts', () => {
    const lines = svc.computeExtraLinesForUnit(
      { sqft: 850, unitTypeId: 'type-b', unitType: { id: 'type-b', name: 'Type B' } },
      [
        {
          code: 'ASSESS',
          description: 'Local council assessment',
          fund: 'MAINTENANCE',
          rateType: 'PER_UNIT_TYPE',
          amount: 0,
          unitTypeAmounts: { 'type-a': 12, 'type-b': 18 },
        },
        {
          code: 'LEVY',
          description: 'Special levy',
          fund: 'SINKING_FUND',
          rateType: 'PER_UNIT_TYPE',
          amount: 0,
          unitTypeAmounts: { 'type-a': 50 },
        },
      ],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      code: 'ASSESS',
      unitPrice: 18,
      fund: 'MAINTENANCE',
      formula: 'Configured rate for Type B',
    });
  });
});

describe('FeeScheduleService.upsertExtraLine fund validation', () => {
  it('rejects create without a valid fund', async () => {
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: 'c1' })) },
      feeScheduleExtraLine: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const service = new FeeScheduleService(prisma);

    await expect(
      service.upsertExtraLine('c1', {
        code: 'MISC',
        description: 'Misc charge',
        rateType: 'FLAT',
        recurring: true,
      } as never),
    ).rejects.toThrow(/Select a fund/);
  });

  it('persists fund on create', async () => {
    const create = vi.fn(async (args: { data: { fund: string } }) => ({
      ...args.data,
      id: 'line-1',
      amount: 0,
      unitTypeAmounts: {},
      effectiveFrom: null,
      effectiveTo: null,
      enabled: true,
      sortOrder: 100,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: 'c1' })) },
      feeScheduleExtraLine: {
        findFirst: vi.fn(),
        create,
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const service = new FeeScheduleService(prisma);

    await service.upsertExtraLine('c1', {
      code: 'FIRE',
      description: 'Fire insurance premium',
      category: 'FIRE_INSURANCE',
      fund: 'SINKING_FUND',
      rateType: 'FLAT',
      recurring: true,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fund: 'SINKING_FUND', code: 'FIRE' }),
      }),
    );
  });
});
