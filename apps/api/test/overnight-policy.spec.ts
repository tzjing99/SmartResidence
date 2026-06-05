import { VisitorStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkUnitOvernightEligibility,
  countMonthlyOvernightForUnit,
  countedOvernightStatuses,
  isOvernightSuspended,
} from '../src/visitor/overnight-policy';
import { DEFAULT_CONDO_VISITOR_SETTINGS } from '../src/visitor/visitor-settings';

describe('overnight-policy', () => {
  const settings = { ...DEFAULT_CONDO_VISITOR_SETTINGS };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts PENDING_MANAGEMENT_APPROVAL toward cap when enabled', () => {
    expect(countedOvernightStatuses({ ...settings, countPendingTowardCap: true })).toContain(
      VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
    );
  });

  it('excludes pending from cap when countPendingTowardCap is false', () => {
    const statuses = countedOvernightStatuses({ ...settings, countPendingTowardCap: false });
    expect(statuses).not.toContain(VisitorStatus.PENDING_MANAGEMENT_APPROVAL);
    expect(statuses).toContain(VisitorStatus.APPROVED);
  });

  it('countMonthlyOvernightForUnit uses settings-driven statuses', async () => {
    const prisma: any = { visitor: { count: vi.fn().mockResolvedValue(3) } };
    const range = { start: new Date('2026-06-01'), end: new Date('2026-07-01') };
    await countMonthlyOvernightForUnit(prisma, 'unit-1', range, settings);
    expect(prisma.visitor.count).toHaveBeenCalledWith({
      where: {
        unitId: 'unit-1',
        overnight: true,
        status: { in: countedOvernightStatuses(settings) },
        createdAt: { gte: range.start, lt: range.end },
      },
    });
  });

  it('blocks registration when monthly unit cap is reached', async () => {
    const prisma: any = {
      unitVisitorPolicy: { findMany: vi.fn().mockResolvedValue([]) },
      visitor: { count: vi.fn().mockResolvedValue(4) },
    };
    const result = await checkUnitOvernightEligibility(prisma, 'unit-1', 'condo-1', settings);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/limit reached/i);
    expect(result.monthlyCount).toBe(4);
  });

  it('blocks registration when unit is suspended', async () => {
    const prisma: any = {
      unitVisitorPolicy: {
        findMany: vi.fn().mockResolvedValue([
          {
            overnightSuspendedUntil: new Date(Date.now() + 86_400_000),
            suspendReason: 'Repeated plate mismatch',
          },
        ]),
      },
      visitor: { count: vi.fn() },
    };
    const result = await checkUnitOvernightEligibility(prisma, 'unit-1', 'condo-1', settings);
    expect(result.allowed).toBe(false);
    expect(result.suspended).toBe(true);
    expect(result.reason).toMatch(/suspended/i);
  });

  it('respects custom monthly limit from settings', async () => {
    const prisma: any = {
      unitVisitorPolicy: { findMany: vi.fn().mockResolvedValue([]) },
      visitor: { count: vi.fn().mockResolvedValue(2) },
    };
    const custom = { ...settings, maxOvernightVisitsPerUnitPerMonth: 2 };
    const result = await checkUnitOvernightEligibility(prisma, 'unit-1', 'condo-1', custom);
    expect(result.allowed).toBe(false);
    expect(result.monthlyLimit).toBe(2);
  });

  it('isOvernightSuspended returns false for expired suspension', () => {
    expect(isOvernightSuspended({ overnightSuspendedUntil: new Date('2020-01-01') })).toBe(false);
  });
});
