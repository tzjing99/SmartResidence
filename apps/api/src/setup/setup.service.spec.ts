import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SetupService } from './setup.service';

const CONDO_ID = 'condo-1';

function manager(): AuthenticatedUser {
  return {
    id: 'mgr-1',
    email: 'admin@acacia.demo',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO_ID,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO_ID, unitId: null, permissions: [] }],
  };
}

function makePrisma(condoSettings: Record<string, unknown> = {}) {
  const condo = {
    id: CONDO_ID,
    name: 'Acacia Residences',
    address: '1 Jalan Demo, Kuala Lumpur',
    settings: {
      billing: { receipt: { organizationName: 'Acacia JMB' } },
      visitor: { maxOvernightVisitsPerUnitPerMonth: 4 },
      ...condoSettings,
    },
  };

  return {
    condo: {
      findUnique: vi.fn(async () => condo),
      update: vi.fn(async () => condo),
    },
    block: { count: vi.fn(async () => 1) },
    unitType: { count: vi.fn(async () => 1) },
    unit: { count: vi.fn(async () => 10) },
    unitTypeFeeRate: { count: vi.fn(async () => 2) },
    paymentGatewayConnection: { count: vi.fn(async () => 1) },
    roleAssignment: { count: vi.fn(async () => 5) },
    slaPolicy: { count: vi.fn(async () => 1) },
    mcpServerConnection: { count: vi.fn(async () => 0) },
    document: { count: vi.fn(async () => 0) },
  } as unknown as PrismaService;
}

describe('SetupService.getStatus', () => {
  it('derives satisfied facts from live condo data', async () => {
    const prisma = makePrisma();
    const service = new SetupService(prisma);
    const status = await service.getStatus(manager(), CONDO_ID);

    const byKey = Object.fromEntries(status.steps.map((s) => [s.key, s]));
    expect(byKey.condoProfile?.satisfied).toBe(true);
    expect(byKey.structure?.satisfied).toBe(true);
    expect(byKey.billing?.satisfied).toBe(true);
    expect(byKey.residents?.satisfied).toBe(true);
    expect(byKey.operations?.satisfied).toBe(true);
    expect(byKey.integrations?.satisfied).toBeNull();
    expect(byKey.documents?.satisfied).toBeNull();
    expect(status.ready).toBe(false);
  });

  it('marks integrations satisfied when MCP connections exist', async () => {
    const prisma = makePrisma();
    vi.mocked(prisma.mcpServerConnection.count).mockResolvedValueOnce(1);
    const service = new SetupService(prisma);
    const status = await service.getStatus(manager(), CONDO_ID);
    const integrations = status.steps.find((s) => s.key === 'integrations');
    expect(integrations?.satisfied).toBe(true);
  });

  it('rejects non-management callers', async () => {
    const prisma = makePrisma();
    const service = new SetupService(prisma);
    const resident: AuthenticatedUser = {
      id: 'owner-1',
      email: 'owner@acacia.demo',
      name: 'Owner',
      locale: 'en',
      activeCondoId: CONDO_ID,
      activeRole: RoleId.UNIT_OWNER,
      roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO_ID, unitId: 'unit-1', permissions: [] }],
    };
    await expect(service.getStatus(resident, CONDO_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
