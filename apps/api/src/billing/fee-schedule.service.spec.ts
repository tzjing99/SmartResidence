import type { PrismaService } from '@/prisma/prisma.service';
import { describe, expect, it } from 'vitest';
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
  it('computes flat and per-sqft extra fee lines', () => {
    const lines = svc.computeExtraLinesForUnit(
      { sqft: 1000, unitTypeId: 'type-a', unitType: { id: 'type-a', name: 'Type A' } },
      [
        {
          code: 'FIRE',
          description: 'Fire insurance premium',
          rateType: 'FLAT',
          amount: 25,
          unitTypeAmounts: {},
        },
        {
          code: 'SEC',
          description: 'Security charge',
          rateType: 'PER_SQFT',
          amount: 0.02,
          unitTypeAmounts: {},
        },
      ],
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ code: 'FIRE', unitPrice: 25, quantity: 1 });
    expect(lines[1]).toMatchObject({ code: 'SEC', unitPrice: 20, quantity: 1 });
  });

  it('uses per-unit-type amounts and skips zero or missing amounts', () => {
    const lines = svc.computeExtraLinesForUnit(
      { sqft: 850, unitTypeId: 'type-b', unitType: { id: 'type-b', name: 'Type B' } },
      [
        {
          code: 'ASSESS',
          description: 'Local council assessment',
          rateType: 'PER_UNIT_TYPE',
          amount: 0,
          unitTypeAmounts: { 'type-a': 12, 'type-b': 18 },
        },
        {
          code: 'LEVY',
          description: 'Special levy',
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
      formula: 'Configured rate for Type B',
    });
  });
});
