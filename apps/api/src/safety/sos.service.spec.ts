import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleId, SosStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SosService } from './sos.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const OWNER_ID = 'owner-1';
const GUARD_ID = 'guard-1';
const SOS_ID = 'sos-1';

function owner(): AuthenticatedUser {
  return {
    id: OWNER_ID,
    email: 'o@b.c',
    name: 'Aisha Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function guard(): AuthenticatedUser {
  return {
    id: GUARD_ID,
    email: 'g@b.c',
    name: 'Pak Guard',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.SECURITY_GUARD,
    roles: [{ roleId: RoleId.SECURITY_GUARD, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function outsider(): AuthenticatedUser {
  return {
    id: 'other-1',
    email: 'x@b.c',
    name: 'Other',
    locale: 'en',
    activeCondoId: 'condo-2',
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: 'condo-2', unitId: 'unit-9', permissions: [] }],
  };
}

function baseAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: SOS_ID,
    condoId: CONDO,
    raisedByUserId: OWNER_ID,
    unitId: UNIT,
    kind: 'GENERAL',
    status: SosStatus.ACTIVE,
    locationNote: null,
    lat: null,
    lng: null,
    acknowledgedByUserId: null,
    acknowledgedAt: null,
    resolvedByUserId: null,
    resolvedAt: null,
    resolutionNote: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPrisma() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
    baseAlert({ ...data, id: SOS_ID }),
  );
  const findUnique = vi.fn(async () => baseAlert());
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => baseAlert(data));
  const prisma = {
    sosAlert: {
      create,
      findUnique,
      update,
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    ownership: { findFirst: vi.fn(async () => ({ id: 'own-1' })) },
    tenancy: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (arg: unknown) => Promise.all(arg as Promise<unknown>[])),
  };
  return { prisma: prisma as unknown as PrismaService, create, findUnique, update };
}

describe('SosService', () => {
  let service: SosService;
  let prisma: ReturnType<typeof buildPrisma>['prisma'];
  let create: ReturnType<typeof buildPrisma>['create'];
  let findUnique: ReturnType<typeof buildPrisma>['findUnique'];
  let update: ReturnType<typeof buildPrisma>['update'];
  let events: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const built = buildPrisma();
    prisma = built.prisma;
    create = built.create;
    findUnique = built.findUnique;
    update = built.update;
    events = { emit: vi.fn() };
    service = new SosService(prisma, events as unknown as EventEmitter2);
  });

  it('raises an ACTIVE alert and emits sos.raised', async () => {
    const alert = await service.raise(owner(), { condoId: CONDO, unitId: UNIT, kind: 'MEDICAL' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          condoId: CONDO,
          raisedByUserId: OWNER_ID,
          unitId: UNIT,
          kind: 'MEDICAL',
        }),
      }),
    );
    expect(alert.status).toBe(SosStatus.ACTIVE);
    expect(events.emit).toHaveBeenCalledWith(
      'sos.raised',
      expect.objectContaining({ condoId: CONDO, sosId: SOS_ID, raisedByUserId: OWNER_ID }),
    );
  });

  it('rejects raising for a condo the user does not belong to', async () => {
    await expect(service.raise(outsider(), { condoId: CONDO })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('lets a guard acknowledge an active alert and emits sos.acknowledged', async () => {
    const result = await service.acknowledge(guard(), SOS_ID);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SosStatus.ACKNOWLEDGED,
          acknowledgedByUserId: GUARD_ID,
        }),
      }),
    );
    expect(result.status).toBe(SosStatus.ACKNOWLEDGED);
    expect(events.emit).toHaveBeenCalledWith(
      'sos.acknowledged',
      expect.objectContaining({ sosId: SOS_ID, raisedByUserId: OWNER_ID }),
    );
  });

  it('refuses to acknowledge an already-acknowledged alert', async () => {
    findUnique.mockResolvedValueOnce(baseAlert({ status: SosStatus.ACKNOWLEDGED }) as never);
    await expect(service.acknowledge(guard(), SOS_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves an open alert and emits sos.resolved', async () => {
    findUnique.mockResolvedValueOnce(baseAlert({ status: SosStatus.ACKNOWLEDGED }) as never);
    const result = await service.resolve(guard(), SOS_ID, { resolutionNote: 'False alarm' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SosStatus.RESOLVED,
          resolvedByUserId: GUARD_ID,
          resolutionNote: 'False alarm',
        }),
      }),
    );
    expect(result.status).toBe(SosStatus.RESOLVED);
    expect(events.emit).toHaveBeenCalledWith(
      'sos.resolved',
      expect.objectContaining({ sosId: SOS_ID }),
    );
  });

  it('runs the full raise -> acknowledge -> resolve lifecycle', async () => {
    const raised = await service.raise(owner(), { condoId: CONDO });
    expect(raised.status).toBe(SosStatus.ACTIVE);

    findUnique.mockResolvedValueOnce(baseAlert({ status: SosStatus.ACTIVE }) as never);
    const ack = await service.acknowledge(guard(), SOS_ID);
    expect(ack.status).toBe(SosStatus.ACKNOWLEDGED);

    findUnique.mockResolvedValueOnce(baseAlert({ status: SosStatus.ACKNOWLEDGED }) as never);
    const resolved = await service.resolve(guard(), SOS_ID, {});
    expect(resolved.status).toBe(SosStatus.RESOLVED);

    expect(events.emit).toHaveBeenCalledWith('sos.raised', expect.anything());
    expect(events.emit).toHaveBeenCalledWith('sos.acknowledged', expect.anything());
    expect(events.emit).toHaveBeenCalledWith('sos.resolved', expect.anything());
  });

  it('lets the raiser cancel their own alert but blocks outsiders', async () => {
    const cancelled = await service.cancel(owner(), SOS_ID);
    expect(cancelled.status).toBe(SosStatus.CANCELLED);

    findUnique.mockResolvedValueOnce(baseAlert() as never);
    await expect(service.cancel(outsider(), SOS_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a resident from acknowledging (management/guard only)', async () => {
    await expect(service.acknowledge(owner(), SOS_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
