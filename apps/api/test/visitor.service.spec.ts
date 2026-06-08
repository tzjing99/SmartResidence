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
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    }),
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
      phone: '123456789',
      vehiclePlate: 'ABC1234',
      expectedAt: new Date('2026-06-10T10:00:00Z'),
    } as any);
    expect(v.accessCode).toBeTruthy();
    expect(prisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+60123456789', phoneCountryCode: '+60' }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('visitor.created', expect.any(Object));
  });

  it('normalizes pre-reg phone to E.164 on create', async () => {
    const { svc, prisma } = service();
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
      status: 'APPROVED',
    });
    await svc.create(host, {
      unitId: 'u1',
      name: 'Mei Lin',
      phone: '0134250927',
      vehiclePlate: 'WSC 1234',
      expectedAt: new Date('2026-06-10T10:00:00Z'),
    } as any);
    expect(prisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+60134250927' }),
      }),
    );
  });

  it('rejects invalid pre-reg phone format', async () => {
    const { svc, prisma } = service();
    prisma.unit.findUnique.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { id: 'c1', settings: {} },
    });
    await expect(
      svc.create(host, {
        unitId: 'u1',
        name: 'Bad phone',
        phone: '12345',
        vehiclePlate: 'ABC1234',
        expectedAt: new Date('2026-06-10T10:00:00Z'),
      } as any),
    ).rejects.toThrow(/valid Malaysia mobile/i);
    expect(prisma.visitor.create).not.toHaveBeenCalled();
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
        phone: '123456789',
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
    prisma.visitor.findUnique.mockResolvedValue(null);
    const expectedAt = new Date();
    expectedAt.setDate(expectedAt.getDate() + 3);
    while (expectedAt.getDay() === 0 || expectedAt.getDay() === 6) {
      expectedAt.setDate(expectedAt.getDate() + 1);
    }
    expectedAt.setHours(20, 0, 0, 0);
    const v = await svc.create(host, {
      unitId: 'u1',
      name: 'Weekday guest',
      phone: '123456789',
      vehiclePlate: 'WXY9876',
      vehiclePlatePhotoUrl: 'uploads/plate2.jpg',
      expectedAt,
      overnight: true,
    } as any);
    expect(v.status).toBe('PENDING_MANAGEMENT_APPROVAL');
    expect(v.accessCode).toBeNull();
  });

  it('rejects overnight on walk-in unit registration', async () => {
    const { svc } = service();
    await expect(
      svc.createWalkInUnit(guard, {
        unitId: 'u1',
        name: 'Bob',
        overnight: true,
      } as any),
    ).rejects.toThrow(/walk-in/i);
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
      unitId: 'u1',
    });
    prisma.ownership.findMany.mockResolvedValueOnce([
      {
        isPrimary: true,
        user: { id: 'owner-user', name: 'Owner', phone: '+60123456789' },
      },
    ]);
    const v = await svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob' } as any);
    expect(v.status).toBe('PENDING_OWNER_APPROVAL');
    expect(v.ownerContacts).toEqual([
      { id: 'owner-user', name: 'Owner', phone: '+60123456789', isPrimary: true },
    ]);
    expect(events.emit).toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
  });

  it('creates walk-in unit without phone', async () => {
    const { svc, prisma } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v2',
      status: 'PENDING_OWNER_APPROVAL',
      visitType: 'WALKIN_UNIT',
      unitId: 'u1',
      phone: null,
    });
    prisma.ownership.findMany.mockResolvedValueOnce([]);
    await svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob' } as any);
    expect(prisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: null }),
      }),
    );
  });

  it('normalizes walk-in phone when provided', async () => {
    const { svc, prisma } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v2',
      status: 'PENDING_OWNER_APPROVAL',
      visitType: 'WALKIN_UNIT',
      unitId: 'u1',
      phone: '+60123456789',
    });
    prisma.ownership.findMany.mockResolvedValueOnce([]);
    await svc.createWalkInUnit(guard, {
      unitId: 'u1',
      name: 'Bob',
      phone: '012-345 6789',
    } as any);
    expect(prisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+60123456789' }),
      }),
    );
  });

  it('rejects invalid walk-in phone format', async () => {
    const { svc, prisma } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    await expect(
      svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob', phone: '12345' } as any),
    ).rejects.toThrow(/valid Malaysia mobile/i);
    expect(prisma.visitor.create).not.toHaveBeenCalled();
  });

  it('resolves legacy phone in guard condo list', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-prereg',
        status: 'APPROVED',
        unitId: 'u1',
        phone: '134250927',
        phoneCountryCode: '+60',
        unit: { block: { name: 'A' } },
        host: null,
        checkIns: [],
      },
    ]);
    prisma.visitor.count.mockResolvedValueOnce(1);
    const result = await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      viewer: guard,
    });
    expect(result.items[0]?.phone).toBe('+60134250927');
  });

  it('includes visitor phone in guard condo list', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v2',
        status: 'PENDING_OWNER_APPROVAL',
        unitId: 'u1',
        phone: '+60199887766',
        unit: { block: { name: 'A' } },
        host: null,
        checkIns: [],
      },
    ]);
    prisma.visitor.count.mockResolvedValueOnce(1);
    prisma.ownership.findMany.mockResolvedValueOnce([
      {
        isPrimary: true,
        user: { id: 'owner-user', name: 'Owner', phone: '+60123456789' },
      },
    ]);
    const result = await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      viewer: guard,
    });
    expect(result.items[0]?.phone).toBe('+60199887766');
    expect(result.items[0]?.ownerContacts?.[0]?.phone).toBe('+60123456789');
  });

  it('exposes owner contacts to guards for pending walk-in only', async () => {
    const { svc, prisma } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'PENDING_OWNER_APPROVAL',
    });
    prisma.ownership.findMany.mockResolvedValueOnce([
      {
        isPrimary: true,
        user: { id: 'owner-user', name: 'Owner', phone: '+60123456789' },
      },
    ]);
    const result = await svc.getWalkInOwnerContacts('v2', guard);
    expect(result.ownerContacts[0]?.phone).toBe('+60123456789');
  });

  it('rejects owner contacts when walk-in is not pending', async () => {
    const { svc, prisma } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'APPROVED',
    });
    await expect(svc.getWalkInOwnerContacts('v2', guard)).rejects.toThrow(/awaiting approval/i);
  });

  it('does not attach owner contacts for non-guard list viewers', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v2',
        status: 'PENDING_OWNER_APPROVAL',
        unitId: 'u1',
        unit: { block: { name: 'A' } },
        host: null,
        checkIns: [],
      },
    ]);
    prisma.visitor.count.mockResolvedValueOnce(1);
    const result = await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      viewer: owner,
    });
    expect(result.items[0]).not.toHaveProperty('ownerContacts');
    expect(prisma.ownership.findMany).not.toHaveBeenCalled();
  });

  it('checks in unit walk-in immediately when owner approval is disabled', async () => {
    const { svc, prisma, events } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: { visitor: { walkInRequireOwnerApproval: false } } },
    });
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v3',
      status: 'CHECKED_IN',
      visitType: 'WALKIN_UNIT',
    });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-1' });
    const v = await svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob' } as any);
    expect(v.status).toBe('CHECKED_IN');
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_in', expect.any(Object));
    expect(events.emit).not.toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
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

  it('does not allow regenerating access codes after pass creation', () => {
    const { svc } = service();
    expect(svc).not.toHaveProperty('regenerateAccessCode');
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

  it('lists checked-in visitors for guard live board with privacy-scoped fields', async () => {
    const { svc, prisma } = service();
    const checkedInAt = new Date('2026-06-08T10:00:00Z');
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-live',
        condoId: 'c1',
        status: 'CHECKED_IN',
        visitType: 'PRE_REG',
        unitId: 'u1',
        name: 'Alice Guest',
        phone: '+6011223344',
        purpose: 'VISITOR',
        vehiclePlate: 'ABC1234',
        overnight: false,
        identification: 'A12345678',
        hostUserId: 'host-user',
        qrCode: 'secret-qr',
        accessCode: 'SECRET1',
        updatedAt: checkedInAt,
        unit: { identifier: '12-03', block: { name: 'Tower A' } },
        host: { id: 'host-user', email: 'host@example.com' },
        checkIns: [{ checkInAt: checkedInAt, checkOutAt: null }],
      },
    ]);
    prisma.ownership.findMany.mockResolvedValueOnce([
      {
        isPrimary: true,
        user: { id: 'owner-user', name: 'Owner', phone: '+60123456789' },
      },
    ]);
    const result = await svc.listLiveForGuard(guard);
    expect(result.total).toBe(1);
    const item = result.items[0]!;
    expect(item.name).toBe('Alice Guest');
    expect(item.unitLabel).toBe('Block Tower A · Unit 12-03');
    expect(item.checkedInAt).toEqual(checkedInAt);
    expect(item.ownerContacts?.[0]?.phone).toBe('+60123456789');
    expect(item).not.toHaveProperty('identification');
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('qrCode');
    expect(item).not.toHaveProperty('accessCode');
    expect(item).not.toHaveProperty('hostUserId');
  });

  it('includes owner contacts for pre-reg on live board with composite unit label', async () => {
    const { svc, prisma } = service();
    const checkedInAt = new Date('2026-06-08T10:00:00Z');
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-prereg',
        condoId: 'c1',
        status: 'CHECKED_IN',
        visitType: 'PRE_REG',
        unitId: 'u-a052',
        name: 'Tan Zi Jing',
        phone: '+6011223344',
        purpose: 'VISITOR',
        vehiclePlate: null,
        overnight: false,
        updatedAt: checkedInAt,
        unit: {
          id: 'u-a052',
          identifier: 'A-05-2',
          block: { name: 'A' },
          ownerships: [{ user: { name: 'Aisyah binti Rahman' } }],
        },
        host: { id: 'owner-user', email: 'owner@acacia.demo' },
        checkIns: [{ checkInAt: checkedInAt, checkOutAt: null }],
      },
    ]);
    prisma.ownership.findMany.mockResolvedValueOnce([
      {
        isPrimary: true,
        user: { id: 'owner-user', name: 'Aisyah binti Rahman', phone: '+60123456789' },
      },
    ]);
    const result = await svc.listLiveForGuard(guard);
    const item = result.items[0]!;
    expect(item.unitLabel).toBe('A-05-2 — Aisyah binti Rahman');
    expect(item.ownerContacts).toEqual([
      {
        id: 'owner-user',
        name: 'Aisyah binti Rahman',
        phone: '+60123456789',
        isPrimary: true,
      },
    ]);
    expect(prisma.ownership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: 'u-a052', status: 'ACTIVE' },
      }),
    );
  });

  it('resolves legacy pre-reg phone on guard live board', async () => {
    const { svc, prisma } = service();
    const checkedInAt = new Date('2026-06-08T10:00:00Z');
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-legacy',
        condoId: 'c1',
        status: 'CHECKED_IN',
        visitType: 'PRE_REG',
        unitId: 'u1',
        name: 'Mei Lin',
        phone: '134250927',
        phoneCountryCode: '+60',
        purpose: 'VISITOR',
        vehiclePlate: null,
        overnight: false,
        updatedAt: checkedInAt,
        unit: { identifier: '12-03', block: { name: 'Tower A' } },
        host: null,
        checkIns: [{ checkInAt: checkedInAt, checkOutAt: null }],
      },
    ]);
    prisma.ownership.findMany.mockResolvedValueOnce([]);
    const result = await svc.listLiveForGuard(guard);
    expect(result.items[0]?.phone).toBe('+60134250927');
  });

  it('excludes checked-out visitors from guard live board', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    const result = await svc.listLiveForGuard(guard);
    expect(result.items).toEqual([]);
    expect(prisma.visitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { condoId: 'c1', status: 'CHECKED_IN' },
      }),
    );
  });

  it('checks out a checked-in visitor and emits event', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-live',
      condoId: 'c1',
      status: 'CHECKED_IN',
      visitType: 'PRE_REG',
      unitId: 'u1',
      qrPayload: 'c1:v-live:ABC123',
      unit: null,
      host: null,
      checkIns: [],
    });
    prisma.visitorCheckIn.findFirst.mockResolvedValueOnce({
      id: 'ci-1',
      visitorId: 'v-live',
      checkOutAt: null,
    });
    prisma.visitorCheckIn.update.mockResolvedValueOnce({
      id: 'ci-1',
      checkOutAt: new Date(),
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v-live', status: 'CHECKED_OUT' });
    const result = await svc.checkOut('v-live', guard);
    expect(result.checkOutAt).toBeTruthy();
    expect(prisma.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-live' },
        data: { status: 'CHECKED_OUT' },
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_out', {
      visitorId: 'v-live',
      condoId: 'c1',
    });
  });

  it('lists unit visitors by live view with checked-in only', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    await svc.listForUnit('u1', { limit: 20, offset: 0, view: 'live' });
    expect(prisma.visitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: 'u1', status: { in: ['CHECKED_IN'] } },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('omits owner contacts for management office walk-ins on live board', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-office',
        condoId: 'c1',
        status: 'CHECKED_IN',
        visitType: 'WALKIN_OFFICE',
        unitId: null,
        name: 'Courier',
        phone: null,
        purpose: 'Parcel',
        vehiclePlate: null,
        overnight: false,
        updatedAt: new Date(),
        unit: null,
        host: null,
        checkIns: [{ checkInAt: new Date(), checkOutAt: null }],
      },
    ]);
    const result = await svc.listLiveForGuard(guard);
    expect(result.items[0]?.unitLabel).toBe('Management office');
    expect(result.items[0]).not.toHaveProperty('ownerContacts');
    expect(prisma.ownership.findMany).not.toHaveBeenCalled();
  });
});
