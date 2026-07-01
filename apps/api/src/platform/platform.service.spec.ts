import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import type { SetupService } from '@/setup/setup.service';
import { NotFoundException } from '@nestjs/common';
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
    condo: {
      findMany: vi.fn(async () => [condoRow]),
      findFirst: vi.fn(async () => condoRow),
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
    },
    roleAssignment: {
      count: vi
        .fn()
        .mockResolvedValueOnce(30) // residents
        .mockResolvedValueOnce(3), // management
    },
  } as unknown as PrismaService;

  const service = new PlatformService(prisma, setup);
  return { service, prisma, setup, condoRow };
}

describe('PlatformService', () => {
  it('returns empty list when no condos match', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.condo.findMany).mockResolvedValueOnce([]);
    await expect(service.listCondos(superAdmin(), {})).resolves.toEqual([]);
  });

  it('lists condos with unit counts and setup readiness', async () => {
    const { service, setup } = makeService();
    const rows = await service.listCondos(superAdmin(), { search: 'acacia' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: CONDO_ID,
      slug: 'acacia',
      unitCount: 42,
      enabledGatewayCount: 1,
      setupReady: true,
    });
    expect(setup.buildStatusForCondo).toHaveBeenCalled();
    expect(rows[0]?.lastActivityAt).toBe('2026-06-20T00:00:00.000Z');
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

  it('throws when condo is missing', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.condo.findFirst).mockResolvedValueOnce(null);
    await expect(service.getCondoSummary(superAdmin(), CONDO_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
