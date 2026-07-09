import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import type { SetupService } from '@/setup/setup.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformService } from './platform.service';

const CONDO_ID = 'condo-1';

function superAdmin(): AuthenticatedUser {
  return {
    id: 'super-1',
    email: 'super@smartresidence.dev',
    name: 'Platform Admin',
    locale: 'en',
    activeCondoId: null,
    activeRole: RoleId.SUPER_ADMIN,
    roles: [{ roleId: RoleId.SUPER_ADMIN, condoId: null, unitId: null, permissions: [] }],
  };
}

function makeService() {
  const condoRow = {
    id: CONDO_ID,
    slug: 'acacia',
    name: 'Acacia Residences',
    address: '1 Jalan Demo',
    countryCode: 'MY',
    timezone: 'Asia/Kuala_Lumpur',
    currencyCode: 'MYR',
    locale: 'en',
    brandColor: null,
    logoUrl: null,
    settings: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
  };

  const setup = {
    buildStatusForCondo: vi.fn(async () => ({
      condoId: CONDO_ID,
      completedAt: null,
      dismissedAt: null,
      ready: true,
      steps: [],
      facts: {},
    })),
    getStatus: vi.fn(async () => ({
      condoId: CONDO_ID,
      completedAt: '2026-06-01T00:00:00.000Z',
      dismissedAt: null,
      ready: true,
      steps: [],
      facts: {},
    })),
  } as unknown as SetupService;

  const prisma = {
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    condo: {
      findMany: vi.fn(async () => [condoRow]),
      findFirst: vi.fn(async () => condoRow),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 1),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: CONDO_ID,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        ...args.data,
      })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...condoRow,
        ...args.data,
      })),
    },
    unit: {
      groupBy: vi.fn(async () => [{ condoId: CONDO_ID, _count: { _all: 42 } }]),
      count: vi.fn(async () => 42),
    },
    block: { count: vi.fn(async () => 2) },
    paymentGatewayConnection: {
      groupBy: vi.fn(async () => [{ condoId: CONDO_ID, _count: { _all: 1 } }]),
      count: vi.fn(async () => 1),
    },
    auditLog: {
      groupBy: vi.fn(async () => [
        { condoId: CONDO_ID, _max: { createdAt: new Date('2026-06-20T00:00:00.000Z') } },
      ]),
      aggregate: vi.fn(async () => ({ _max: { createdAt: new Date('2026-06-20T00:00:00.000Z') } })),
      findMany: vi.fn(async () => [
        {
          id: 'audit-1',
          action: 'CREATE',
          resourceType: 'Unit',
          resourceId: 'unit-1',
          createdAt: new Date('2026-06-20T00:00:00.000Z'),
          actor: { name: 'Admin User' },
        },
      ]),
      create: vi.fn(async () => ({})),
    },
    roleAssignment: {
      groupBy: vi.fn(async () => [
        { condoId: CONDO_ID, userId: 'user-1' },
        { condoId: CONDO_ID, userId: 'user-2' },
      ]),
      count: vi.fn().mockResolvedValueOnce(30).mockResolvedValueOnce(3),
    },
    defect: {
      groupBy: vi.fn(async () => [{ condoId: CONDO_ID, _count: { _all: 5 } }]),
      count: vi.fn(async () => 5),
    },
    invoice: {
      groupBy: vi.fn(async () => [{ condoId: CONDO_ID, _count: { _all: 2 } }]),
      findMany: vi.fn(async () => [
        { total: 100, amountPaid: 20 },
        { total: 50, amountPaid: 0 },
      ]),
    },
  } as unknown as PrismaService;

  const service = new PlatformService(prisma, setup);
  return { service, prisma, setup, condoRow };
}

describe('PlatformService', () => {
  it('returns empty paginated list when no condos match', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.condo.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.condo.count).mockResolvedValueOnce(0);
    await expect(service.listCondos(superAdmin(), { limit: 25, offset: 0 })).resolves.toEqual({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
  });

  it('lists condos with health counts and setup readiness', async () => {
    const { service, setup } = makeService();
    const page = await service.listCondos(superAdmin(), { search: 'acacia', limit: 25, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: CONDO_ID,
      slug: 'acacia',
      unitCount: 42,
      userCount: 2,
      enabledGatewayCount: 1,
      openDefectCount: 5,
      overdueInvoiceCount: 2,
      setupReady: true,
    });
    expect(setup.buildStatusForCondo).toHaveBeenCalled();
    expect(page.items[0]?.lastActivityAt).toBe('2026-06-20T00:00:00.000Z');
  });

  it('returns drill-down summary for a condo', async () => {
    const { service, setup } = makeService();
    const detail = await service.getCondoSummary(superAdmin(), CONDO_ID);
    expect(detail).toMatchObject({
      id: CONDO_ID,
      unitCount: 42,
      blockCount: 2,
      residentCount: 30,
      managementCount: 3,
      enabledGatewayCount: 1,
    });
    expect(setup.getStatus).toHaveBeenCalledWith(superAdmin(), CONDO_ID);
  });

  it('returns health dashboard for a condo', async () => {
    const { service } = makeService();
    const health = await service.getCondoHealth(superAdmin(), CONDO_ID);
    expect(health).toMatchObject({
      condoId: CONDO_ID,
      userCount: 2,
      unitCount: 42,
      openDefectCount: 5,
      billing: {
        overdueInvoiceCount: 2,
        overdueAmount: 130,
        currencyCode: 'MYR',
      },
    });
    expect(health.recentAuditEvents).toHaveLength(1);
  });

  it('provisions a condo and writes an audit log', async () => {
    const { service, prisma } = makeService();
    const created = await service.provisionCondo(superAdmin(), {
      name: 'New Tower',
      slug: 'new-tower',
      address: '2 Demo Road',
      timezone: 'Asia/Kuala_Lumpur',
    });
    expect(created).toMatchObject({
      slug: 'new-tower',
      name: 'New Tower',
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects duplicate slug on provision', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.condo.findUnique).mockResolvedValueOnce({
      id: 'existing',
      slug: 'new-tower',
    } as never);
    await expect(
      service.provisionCondo(superAdmin(), {
        name: 'New Tower',
        slug: 'new-tower',
        address: '2 Demo Road',
        timezone: 'Asia/Kuala_Lumpur',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when condo is missing', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.condo.findFirst).mockResolvedValueOnce(null);
    await expect(service.getCondoSummary(superAdmin(), CONDO_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns default feature flags for a condo', async () => {
    const { service } = makeService();
    const flags = await service.getFeatureFlags(superAdmin(), CONDO_ID);
    expect(flags.condoId).toBe(CONDO_ID);
    expect(flags.flags).toHaveLength(4);
    expect(flags.flags.every((f) => f.enabled === false)).toBe(true);
  });

  it('updates feature flags, persists settings, and audits changes', async () => {
    const { service, prisma } = makeService();
    const result = await service.updateFeatureFlags(superAdmin(), CONDO_ID, {
      helpdeskMlPriority: true,
      whatsappNotifications: true,
    });
    expect(result.flags.find((f) => f.key === 'helpdeskMlPriority')?.enabled).toBe(true);
    expect(result.flags.find((f) => f.key === 'whatsappNotifications')?.enabled).toBe(true);
    expect(prisma.condo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONDO_ID },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            featureFlags: expect.objectContaining({
              helpdeskMlPriority: true,
              whatsappNotifications: true,
            }),
          }),
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'CondoFeatureFlags',
          action: 'UPDATE',
          metadata: expect.objectContaining({
            source: 'platform.featureFlags',
            changed: expect.arrayContaining(['helpdeskMlPriority', 'whatsappNotifications']),
          }),
        }),
      }),
    );
  });

  it('rejects empty feature flag patches', async () => {
    const { service } = makeService();
    await expect(service.updateFeatureFlags(superAdmin(), CONDO_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
