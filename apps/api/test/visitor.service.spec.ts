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

/** listLiveForGuard runs auto-close (findMany) before the live-board query. */
function mockGuardLiveFindMany(prisma: any, items: unknown[]) {
  prisma.condo.findUnique.mockResolvedValue({ timezone: 'Asia/Kuala_Lumpur' });
  prisma.visitor.findMany.mockResolvedValueOnce([]);
  prisma.visitor.findMany.mockResolvedValueOnce(items);
}

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
    const v = await svc.createWalkInUnit(guard, {
      unitId: 'u1',
      name: 'Bob',
      phone: '+60123456789',
    } as any);
    expect(v.status).toBe('PENDING_OWNER_APPROVAL');
    expect(v.ownerContacts).toEqual([
      { id: 'owner-user', name: 'Owner', phone: '+60123456789', isPrimary: true },
    ]);
    expect(events.emit).toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
  });

  it('rejects guard walk-in unit without phone', async () => {
    const { svc, prisma } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    await expect(svc.createWalkInUnit(guard, { unitId: 'u1', name: 'Bob' } as any)).rejects.toThrow(
      /phone number is required/i,
    );
    expect(prisma.visitor.create).not.toHaveBeenCalled();
  });

  it('rejects guard walk-in office without phone', async () => {
    const { svc, prisma } = service();
    await expect(
      svc.createWalkInOffice(guard, { name: 'Courier', purpose: 'Parcel' } as any),
    ).rejects.toThrow(/phone number is required/i);
    expect(prisma.visitor.create).not.toHaveBeenCalled();
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
        unitId: 'u1',
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

  it('rejects upcoming view for guard condo list', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'Asia/Kuala_Lumpur' });
    await expect(
      svc.listForCondo('c1', {
        limit: 20,
        offset: 0,
        view: 'upcoming',
        viewer: guard,
      }),
    ).rejects.toThrow(/future expected visitors/i);
    expect(prisma.visitor.findMany).not.toHaveBeenCalled();
  });

  it('scopes guard condo list to today by default', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    await svc.listForCondo('c1', { limit: 20, offset: 0, viewer: guard });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where.expectedAt.gte).toBeInstanceOf(Date);
    expect(where.expectedAt.lt).toBeInstanceOf(Date);
    expect(where.expectedAt.lt.getTime() - where.expectedAt.gte.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(where.status).toEqual({ notIn: expect.arrayContaining(['CHECKED_OUT', 'EXPIRED']) });
  });

  it('excludes future expected visitors for guard today list', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    await svc.listForCondo('c1', { limit: 20, offset: 0, status: 'APPROVED', viewer: guard });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where.status).toBe('APPROVED');
    expect(where.expectedAt.lt.getTime()).toBeLessThanOrEqual(
      where.expectedAt.gte.getTime() + 24 * 60 * 60 * 1000,
    );
    const tomorrow = new Date(where.expectedAt.lt);
    expect(tomorrow.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('scopes guard expected view to today upcoming statuses only', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-expected',
        name: 'Alex Guest',
        status: 'APPROVED',
        expectedAt: new Date(),
        visitType: 'PRE_REG',
        phone: '+60199887766',
        phoneCountryCode: '+60',
        unit: { block: { name: 'A' }, identifier: 'A-12-03' },
        host: null,
        checkIns: [],
      },
    ]);
    prisma.visitor.count.mockResolvedValueOnce(1);
    const result = await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      view: 'expected',
      viewer: guard,
    });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where.expectedAt.gte).toBeInstanceOf(Date);
    expect(where.expectedAt.lt).toBeInstanceOf(Date);
    expect(where.status).toEqual({
      in: expect.arrayContaining(['APPROVED', 'PENDING_OWNER_APPROVAL']),
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'v-expected',
        name: expect.any(String),
        unitLabel: expect.any(String),
      }),
    );
    expect(result.items[0]).not.toHaveProperty('phone');
    expect(prisma.visitor.findMany.mock.calls[0]?.[0]?.orderBy).toEqual({ expectedAt: 'asc' });
  });

  it('scopes guard no_show view to today expired passes', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      view: 'no_show',
      viewer: guard,
    });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where.expectedAt.gte).toBeInstanceOf(Date);
    expect(where.status).toBe('EXPIRED');
  });

  it('returns past and completed visitors for guard history view', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.condo.findUnique.mockResolvedValueOnce({ timezone: 'UTC' });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      view: 'history',
      viewer: guard,
    });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { expectedAt: { lt: expect.any(Date) } },
        {
          OR: [
            { expectedAt: { lt: expect.any(Date) } },
            { status: { in: expect.arrayContaining(['CHECKED_OUT', 'EXPIRED']) } },
          ],
        },
      ]),
    );
  });

  it('does not apply guard date filters for management viewers', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findMany.mockResolvedValueOnce([]);
    prisma.visitor.count.mockResolvedValueOnce(0);
    const admin: any = {
      id: 'admin-user',
      activeRole: 'MANAGEMENT_ADMIN',
      activeCondoId: 'c1',
      roles: [{ roleId: 'MANAGEMENT_ADMIN', condoId: 'c1', unitId: null, permissions: [] }],
    };
    await svc.listForCondo('c1', {
      limit: 20,
      offset: 0,
      view: 'upcoming',
      viewer: admin,
    });
    const where = prisma.visitor.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({
      condoId: 'c1',
      status: { in: expect.arrayContaining(['APPROVED', 'PENDING_OWNER_APPROVAL']) },
    });
    expect(prisma.condo.findUnique).not.toHaveBeenCalled();
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
    const v = await svc.createWalkInUnit(guard, {
      unitId: 'u1',
      name: 'Bob',
      phone: '+60123456789',
    } as any);
    expect(v.status).toBe('CHECKED_IN');
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_in', expect.any(Object));
    expect(events.emit).not.toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
  });

  it('admits unit walk-in on the spot by guard discretion, overriding owner-approval policy', async () => {
    const { svc, prisma, events } = service();
    prisma.unit.findFirst.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      // Policy requires owner approval — guard discretion must override it.
      condo: { settings: { visitor: { walkInRequireOwnerApproval: true } } },
    });
    prisma.visitor.create.mockResolvedValueOnce({
      id: 'v-admit',
      status: 'CHECKED_IN',
      visitType: 'WALKIN_UNIT',
      unitId: 'u1',
    });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-admit' });
    const v = await svc.createWalkInUnit(guard, {
      unitId: 'u1',
      name: 'Reno Contractor',
      phone: '+60123456789',
      purpose: 'Renovation',
      admitNow: true,
      photoUrl: 'uploads/walk-in.jpg',
    } as any);
    expect(v.status).toBe('CHECKED_IN');
    // Attribution: recorded against the guard + admission source in metadata.
    expect(prisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CHECKED_IN',
          admittedByGuardUserId: 'guard-user',
          approvedByUserId: 'guard-user',
          metadata: expect.objectContaining({
            admissionSource: 'GUARD_WALK_IN',
            admitPhotoUrl: 'uploads/walk-in.jpg',
          }),
        }),
      }),
    );
    expect(prisma.visitorCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ checkInGuardId: 'guard-user' }),
      }),
    );
    // Owner gets a transparency notification (not the approval-request flow).
    expect(events.emit).toHaveBeenCalledWith('visitor.walk_in_admitted', expect.any(Object));
    expect(events.emit).not.toHaveBeenCalledWith('visitor.walk_in_requested', expect.any(Object));
  });

  it('rejects overnight on guard-admitted walk-in', async () => {
    const { svc } = service();
    await expect(
      svc.createWalkInUnit(guard, {
        unitId: 'u1',
        name: 'Bob',
        phone: '+60123456789',
        admitNow: true,
        overnight: true,
      } as any),
    ).rejects.toThrow(/walk-in/i);
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

  it('guard manual approval of pending walk-in goes straight to CHECKED_IN', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'PENDING_OWNER_APPROVAL',
      metadata: { createdByGuardId: 'guard-user', singleVisit: true },
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v2', status: 'CHECKED_IN' });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-1' });
    const v = await svc.approveWalkInByGuard('v2', guard, 'GUARD_MANUAL');
    expect(v.status).toBe('CHECKED_IN');
    // approve + check-in happen atomically — never lands in APPROVED/expected
    expect(prisma.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CHECKED_IN',
          approvedByUserId: 'guard-user',
          metadata: expect.objectContaining({ approvalMethod: 'GUARD_MANUAL' }),
        }),
      }),
    );
    expect(prisma.visitorCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visitorId: 'v2', checkInGuardId: 'guard-user' }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_in', expect.any(Object));
    expect(events.emit).not.toHaveBeenCalledWith('visitor.approved', expect.any(Object));
  });

  it('owner-by-phone approval records method and checks in', async () => {
    const { svc, prisma } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'PENDING_OWNER_APPROVAL',
      metadata: {},
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v2', status: 'CHECKED_IN' });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-1' });
    const v = await svc.approveWalkInByGuard('v2', guard, 'OWNER_BY_PHONE');
    expect(v.status).toBe('CHECKED_IN');
    expect(prisma.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CHECKED_IN',
          metadata: expect.objectContaining({ approvalMethod: 'OWNER_BY_PHONE' }),
        }),
      }),
    );
    // audit log records the guard decision + method
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'Visitor',
          metadata: expect.objectContaining({
            decision: 'guard_approved',
            method: 'OWNER_BY_PHONE',
          }),
        }),
      }),
    );
  });

  it('rejects guard approval for non-pending walk-in', async () => {
    const { svc, prisma } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v2',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'CHECKED_IN',
    });
    await expect(svc.approveWalkInByGuard('v2', guard, 'GUARD_MANUAL')).rejects.toThrow(
      /not awaiting approval/i,
    );
    expect(prisma.visitorCheckIn.create).not.toHaveBeenCalled();
  });

  it('rejects guard approval for owner pre-registered pass', async () => {
    const { svc, prisma } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-pre',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'PRE_REG',
      status: 'APPROVED',
      hostUserId: 'owner-user',
    });
    await expect(svc.approveWalkInByGuard('v-pre', guard, 'GUARD_MANUAL')).rejects.toThrow(
      /Only unit walk-in visitors can be approved at the gate/i,
    );
    expect(prisma.visitor.update).not.toHaveBeenCalled();
    expect(prisma.visitorCheckIn.create).not.toHaveBeenCalled();
  });

  it('does not let reject endpoint deny owner pre-registered pass', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-pre',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'PRE_REG',
      status: 'APPROVED',
      hostUserId: 'owner-user',
    });
    await expect(svc.reject('v-pre', owner, 'No entry')).rejects.toThrow(
      /Only unit walk-in visitors can be rejected/i,
    );
    expect(prisma.visitor.update).not.toHaveBeenCalled();
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

  it('rejects check-in for pre-registration awaiting management approval', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findFirst.mockResolvedValueOnce({
      id: 'v-mgmt',
      condoId: 'c1',
      unitId: 'u1',
      status: 'PENDING_MANAGEMENT_APPROVAL',
      visitType: 'PRE_REG',
      qrPayload: 'c1:v-mgmt:ABC123',
      overnight: true,
    });
    await expect(svc.checkIn('c1:v-mgmt:ABC123', guard, {} as any)).rejects.toThrow(
      /awaiting management approval/i,
    );
    expect(prisma.visitor.update).not.toHaveBeenCalled();
    expect(prisma.visitorCheckIn.create).not.toHaveBeenCalled();
  });

  it('checks in approved owner pre-registration directly from QR', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findFirst.mockResolvedValueOnce({
      id: 'v-pre',
      condoId: 'c1',
      unitId: 'u1',
      status: 'APPROVED',
      visitType: 'PRE_REG',
      accessCode: 'ABC123',
      qrPayload: 'c1:v-pre:ABC123',
      expiresAt: new Date(Date.now() + 60_000),
      overnight: false,
    });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-pre', visitorId: 'v-pre' });
    const result = await svc.checkIn('c1:v-pre:ABC123', guard, {
      gateLocation: 'Main gate',
    } as any);
    expect(result.id).toBe('ci-pre');
    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v-pre' },
      data: { status: 'CHECKED_IN' },
    });
    expect(prisma.visitorCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId: 'v-pre',
          checkInGuardId: 'guard-user',
          gateLocation: 'Main gate',
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_in', {
      visitorId: 'v-pre',
      condoId: 'c1',
    });
  });

  it('rejects verify and check-in for cancelled pass by access code', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    const cancelled = {
      id: 'v-cancel',
      condoId: 'c1',
      unitId: 'u1',
      status: 'CANCELLED',
      visitType: 'PRE_REG',
      accessCode: 'X7K9M2',
      qrPayload: 'c1:v-cancel:X7K9M2',
    };
    prisma.visitor.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cancelled);
    await expect(svc.verifyByPass('X7K9M2', 'c1')).rejects.toThrow(/cancelled/i);
    prisma.visitor.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cancelled);
    await expect(svc.checkIn('X7K9M2', guard, {} as any)).rejects.toThrow(/cancelled/i);
  });

  it('cancels upcoming pre-reg for unit owner', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-up',
      unitId: 'u1',
      condoId: 'c1',
      status: 'APPROVED',
      visitType: 'PRE_REG',
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v-up', status: 'CANCELLED' });
    const v = await svc.cancel('v-up', owner);
    expect(v.status).toBe('CANCELLED');
    expect(prisma.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-up' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('visitor.cancelled', {
      visitorId: 'v-up',
      condoId: 'c1',
    });
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
    mockGuardLiveFindMany(prisma, [
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
        unitId: 'u1',
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
    mockGuardLiveFindMany(prisma, [
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
        unitId: 'u-a052',
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
        where: { unitId: { in: ['u-a052'] }, status: 'ACTIVE' },
      }),
    );
  });

  it('resolves legacy pre-reg phone on guard live board', async () => {
    const { svc, prisma } = service();
    const checkedInAt = new Date('2026-06-08T10:00:00Z');
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    mockGuardLiveFindMany(prisma, [
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
    mockGuardLiveFindMany(prisma, []);
    const result = await svc.listLiveForGuard(guard);
    expect(result.items).toEqual([]);
    expect(prisma.visitor.findMany).toHaveBeenLastCalledWith(
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

  it('rejects manual checkout for walk-in visitors', async () => {
    const { svc, prisma } = service();
    prisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-walk',
      condoId: 'c1',
      status: 'CHECKED_IN',
      visitType: 'WALKIN_UNIT',
      unitId: 'u1',
      unit: null,
      host: null,
      checkIns: [],
    });
    await expect(svc.checkOut('v-walk', guard)).rejects.toThrow(/close automatically/i);
    expect(prisma.visitorCheckIn.findFirst).not.toHaveBeenCalled();
  });

  it('auto-closes stale day pre-reg visitors at condo day boundary', async () => {
    const { svc, prisma, events } = service();
    const yesterday = new Date('2026-06-07T14:00:00Z');
    prisma.condo.findUnique.mockResolvedValue({ timezone: 'Asia/Kuala_Lumpur' });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-stale',
        condoId: 'c1',
        visitType: 'PRE_REG',
        overnight: false,
        expiresAt: null,
        checkIns: [{ id: 'ci-1', checkInAt: yesterday, checkOutAt: null }],
      },
    ]);
    prisma.visitorCheckIn.update.mockResolvedValue({});
    prisma.visitor.update.mockResolvedValue({});

    const closed = await svc.autoCloseStaleVisitors('c1', new Date('2026-06-08T10:00:00Z'));
    expect(closed).toBe(1);
    expect(prisma.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-stale' },
        data: { status: 'CHECKED_OUT' },
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'visitor.checked_out',
      expect.objectContaining({ visitorId: 'v-stale', condoId: 'c1', auto: true }),
    );
  });

  it('keeps overnight pre-reg open until expiresAt', async () => {
    const { svc, prisma, events } = service();
    const yesterday = new Date('2026-06-07T20:00:00Z');
    const tomorrow = new Date('2026-06-09T06:00:00Z');
    prisma.condo.findUnique.mockResolvedValue({ timezone: 'Asia/Kuala_Lumpur' });
    prisma.visitor.findMany.mockResolvedValueOnce([
      {
        id: 'v-overnight',
        condoId: 'c1',
        visitType: 'PRE_REG',
        overnight: true,
        expiresAt: tomorrow,
        checkIns: [{ id: 'ci-2', checkInAt: yesterday, checkOutAt: null }],
      },
    ]);

    const closed = await svc.autoCloseStaleVisitors('c1', new Date('2026-06-08T10:00:00Z'));
    expect(closed).toBe(0);
    expect(prisma.visitorCheckIn.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(
      'visitor.checked_out',
      expect.objectContaining({ visitorId: 'v-overnight' }),
    );
  });

  it('acknowledges owner-approved unit walk-in without a pass', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v-walk',
      condoId: 'c1',
      unitId: 'u1',
      visitType: 'WALKIN_UNIT',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.visitor.update.mockResolvedValueOnce({ id: 'v-walk', status: 'CHECKED_IN' });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci-walk', visitorId: 'v-walk' });
    const result = await svc.acknowledgeWalkIn('v-walk', guard, { gateLocation: 'Main gate' });
    expect(result.id).toBe('ci-walk');
    expect(prisma.visitor.update).toHaveBeenCalledWith({
      where: { id: 'v-walk' },
      data: { status: 'CHECKED_IN' },
    });
    expect(events.emit).toHaveBeenCalledWith('visitor.checked_in', {
      visitorId: 'v-walk',
      condoId: 'c1',
    });
  });

  it('rejects overnight on drive-in pre-reg when entry mode is walk-in', async () => {
    const { svc, prisma } = service();
    prisma.unit.findUnique.mockResolvedValueOnce({
      id: 'u1',
      condoId: 'c1',
      condo: { settings: {} },
    });
    await expect(
      svc.create(host, {
        unitId: 'u1',
        name: 'Guest',
        phone: '+60123456789',
        expectedAt: new Date(Date.now() + 86_400_000),
        entryMode: 'WALK_IN',
        overnight: true,
      } as any),
    ).rejects.toThrow(/drive-in pre-registration/i);
    expect(prisma.visitor.create).not.toHaveBeenCalled();
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
    mockGuardLiveFindMany(prisma, [
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
