import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isWithinRecurringSchedule } from '../src/visitor/recurring-pass-schedule';
import { RecurringPassService } from '../src/visitor/recurring-pass.service';
import { VisitorBlacklistBlockedError } from '../src/visitor/visitor-blacklist.service';

describe('recurring pass schedule', () => {
  it('accepts weekday within time window', () => {
    // Monday 2026-06-01 10:00 KL
    const instant = new Date('2026-06-01T02:00:00.000Z');
    const result = isWithinRecurringSchedule(
      { daysOfWeek: [1], timeWindow: { start: '08:00', end: '18:00' } },
      instant,
      'Asia/Kuala_Lumpur',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects outside time window', () => {
    const instant = new Date('2026-06-01T14:00:00.000Z'); // 22:00 KL
    const result = isWithinRecurringSchedule(
      { daysOfWeek: [1], timeWindow: { start: '08:00', end: '18:00' } },
      instant,
      'Asia/Kuala_Lumpur',
    );
    expect(result.ok).toBe(false);
  });
});

function service() {
  const prisma: any = {
    unit: { findUnique: vi.fn() },
    condo: { findUnique: vi.fn() },
    recurringPass: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    visitor: { findUnique: vi.fn(), create: vi.fn() },
    visitorCheckIn: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };
  const blacklist: any = {
    assertNotBlacklisted: vi.fn().mockResolvedValue(undefined),
  };
  const events: any = { emit: vi.fn() };
  return { svc: new RecurringPassService(prisma, blacklist, events), prisma, blacklist, events };
}

const owner: any = {
  id: 'owner-1',
  activeRole: 'UNIT_OWNER',
  roles: [{ roleId: 'UNIT_OWNER', condoId: 'c1', unitId: 'u1' }],
};

const guard: any = {
  id: 'guard-1',
  activeRole: 'SECURITY_GUARD',
  activeCondoId: 'c1',
  roles: [{ roleId: 'SECURITY_GUARD', condoId: 'c1', unitId: null }],
};

describe('RecurringPassService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates recurring pass with access code', async () => {
    const { svc, prisma } = service();
    prisma.unit.findUnique.mockResolvedValue({
      id: 'u1',
      condoId: 'c1',
      condo: { id: 'c1' },
      block: { name: 'A' },
      identifier: '12-03',
    });
    prisma.visitor.findUnique.mockResolvedValue(null);
    prisma.recurringPass.findUnique.mockResolvedValue(null);
    prisma.recurringPass.create.mockResolvedValue({ id: 'rp-1', condoId: 'c1' });
    prisma.recurringPass.update.mockResolvedValue({
      id: 'rp-1',
      accessCode: 'ABC123',
      guestName: 'Puan Siti',
    });

    const pass = await svc.create(owner, {
      unitId: 'u1',
      guestName: 'Puan Siti',
      schedule: { daysOfWeek: [1, 3, 5], timeWindow: { start: '09:00', end: '17:00' } },
      validFrom: new Date('2026-06-01'),
      validUntil: new Date('2026-12-31'),
    });

    expect(pass.accessCode).toBeTruthy();
    expect(prisma.recurringPass.create).toHaveBeenCalled();
  });

  it('check-in blocks blacklisted guest', async () => {
    const { svc, prisma, blacklist } = service();
    const now = new Date('2026-06-02T02:00:00.000Z'); // Tue 10:00 KL
    vi.setSystemTime(now);

    prisma.recurringPass.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'rp-1',
      condoId: 'c1',
      unitId: 'u1',
      hostUserId: 'owner-1',
      guestName: 'Encik Razak',
      guestPhone: '+60123456789',
      vehiclePlate: null,
      schedule: { daysOfWeek: [2], timeWindow: { start: '08:00', end: '18:00' } },
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-01-01'),
      active: true,
      accessCode: 'PASS01',
      unit: { block: { name: 'B' }, identifier: '08-01' },
    });
    prisma.condo.findUnique.mockResolvedValue({ timezone: 'Asia/Kuala_Lumpur' });
    blacklist.assertNotBlacklisted.mockRejectedValue(
      new VisitorBlacklistBlockedError('Repeated trespassing'),
    );

    await expect(svc.checkIn('PASS01', guard, {})).rejects.toThrow(/blacklist/i);
    vi.useRealTimers();
  });
});
