import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQrPayload,
  generateAccessCode,
  normalizePassInput,
  parseQrPayload,
} from '../src/visitor/access-code';
import { VisitorService } from '../src/visitor/visitor.service';

function service() {
  const prisma: any = {
    condo: { findUnique: vi.fn() },
    unit: { findUnique: vi.fn(), findFirst: vi.fn() },
    visitor: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    visitorCheckIn: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    ownership: { findMany: vi.fn(), findFirst: vi.fn() },
    tenancy: { findMany: vi.fn() },
    unitVisitorPolicy: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => (typeof cb === 'function' ? cb(prisma) : cb)),
  };
  const events: any = { emit: vi.fn() };
  const notifications: any = { dispatch: vi.fn().mockResolvedValue(undefined) };
  return { svc: new VisitorService(prisma, events, notifications), prisma, events, notifications };
}

function mockOvernightEligibility(prisma: any) {
  prisma.ownership.findFirst.mockResolvedValue({
    userId: 'owner-user',
    user: { id: 'owner-user', name: 'Owner' },
  });
  prisma.unitVisitorPolicy.findMany.mockResolvedValue([]);
}

const host: any = {
  id: 'host-user',
  activeRole: 'UNIT_OWNER',
  activeCondoId: 'c1',
  roles: [{ roleId: 'UNIT_OWNER', condoId: 'c1', unitId: 'u1', permissions: [] }],
};
const guard: any = {
  id: 'guard-user',
  activeRole: 'SECURITY_GUARD',
  activeCondoId: 'c1',
  roles: [{ roleId: 'SECURITY_GUARD', condoId: 'c1', unitId: null, permissions: [] }],
};
const owner: any = {
  id: 'owner-user',
  activeRole: 'UNIT_OWNER',
  activeCondoId: 'c1',
  roles: [{ roleId: 'UNIT_OWNER', condoId: 'c1', unitId: 'u1', permissions: [] }],
};

describe('access-code', () => {
  it('generates 6-char codes from the readable alphabet', () => {
    const code = generateAccessCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('builds and parses QR payload', () => {
    const payload = buildQrPayload('condo-1', 'visitor-1', 'ABC123');
    expect(payload).toBe('condo-1:visitor-1:ABC123');
    expect(parseQrPayload(payload)).toEqual({
      condoId: 'condo-1',
      visitorId: 'visitor-1',
      accessCode: 'ABC123',
    });
  });

  it('normalizes short codes to uppercase', () => {
    expect(normalizePassInput(' abc12d ')).toBe('ABC12D');
  });
});

describe('VisitorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a PRE_REG visitor with access code and expiry', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.unit.findUnique.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { id: 'c1', settings: {} },
    });
    prisma.visitor.count.mockResolvedValue(0);
    prisma.visitor.findUnique.mockResolvedValue(null);
    prisma.visitor.create.mockResolvedValueOnce({ id: 'v1', condoId: 'c1' });
    prisma.visitor.update.mockResolvedValueOnce({
      id: 'v1',
      condoId: 'c1',
      visitType: 'PRE_REG',
      accessCode: 'K7M3P9',
      qrPayload: 'c1:v1:K7M3P9',
      status: 'APPROVED',
    });
    const v = await svc.create(host, {
      unitId: 'u1',
      name: 'Jane Doe',
      expectedAt: new Date('2026-06-10T10:00:00Z'),
    } as any);
    expect(v.accessCode).toBeTruthy();
    expect(events.emit).toHaveBeenCalledWith('visitor.created', expect.any(Object));
  });

  it('requires urgent reason for overnight pre-reg under 24h', async () => {
    const { svc, prisma } = service();
    mockOvernightEligibility(prisma);
    prisma.unit.findUnique.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { id: 'c1', settings: {} },
    });
    prisma.visitor.count.mockResolvedValue(0);
    await expect(
      svc.create(host, {
        unitId: 'u1',
        name: 'Late guest',
        vehiclePlate: 'ABC1234',
        vehiclePlatePhotoUrl: 'uploads/plate.jpg',
        expectedAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        overnight: true,
      } as any),
    ).rejects.toThrow(/urgent/i);
    expect(prisma.visitor.create).not.toHaveBeenCalled();
  });

  it('creates overnight pre-reg as PENDING_MANAGEMENT_APPROVAL without pass', async () => {
    const { svc, prisma } = service();
    mockOvernightEligibility(prisma);
    prisma.unit.findUnique.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { id: 'c1', settings: { visitor: { workingDays: { weekdays: [1, 2, 3, 4, 5] } } } },
    });
    prisma.visitor.count.mockResolvedValue(0);
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v-overnight',
      status: 'PENDING_MANAGEMENT_APPROVAL',
      accessCode: null,
      overnight: true,
      urgentOvernight: false,
    });
    const v = await svc.create(host, {
      unitId: 'u1',
      name: 'Weekend guest',
      vehiclePlate: 'WXY9876',
      vehiclePlatePhotoUrl: 'uploads/plate2.jpg',
      expectedAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      overnight: true,
    } as any);
    expect(v.status).toBe('PENDING_MANAGEMENT_APPROVAL');
    expect(v.accessCode).toBeNull();
  });

  it('creates walk-in unit as PENDING_OWNER_APPROVAL', async () => {
    const { svc, prisma, events } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v2',
      status: 'PENDING_OWNER_APPROVAL',
      visitType: 'WALKIN_UNIT',
    });
    const v = await svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob' } as any);
    expect(v.status).toBe('PENDING_OWNER_APPROVAL');
    expect(events.emit).toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
  });

  it('lets owner approve walk-in and sets expiry window', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'PENDING_OWNER_APPROVAL',
      approvalDeadline: new Date(Date.now() + 60_000),
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v2', status: 'APPROVED' });
    const v = await svc.approve('v2', owner);
    expect(v.status).toBe('APPROVED');
    expect(events.emit).toHaveBeenCalledWith('visitor.approved', expect.any(Object));
  });

  it('rejects check-in for pending walk-in', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      status: 'PENDING_OWNER_APPROVAL',
      visitType: 'WALKIN_UNIT',
      qrPayload: 'c1:v2:ABC123',
    });
    await expect(svc.checkIn('c1:v2:ABC123', guard, {} as any)).rejects.toThrow(/Cannot check in/);
  });

  it('resolves pass by condo-scoped access code', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'v1',
        condoId: 'c1',
        status: 'APPROVED',
        accessCode: 'K7M3P9',
        visitType: 'PRE_REG',
      });
    const v = await svc.verifyByPass('k7m3p9', 'c1');
    expect(v.id).toBe('v1');
  });
});
