import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ParcelStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ParcelService } from './parcel.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';

function guard(): AuthenticatedUser {
  return {
    id: 'guard-1',
    email: 'g@b.c',
    name: 'Guard',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.SECURITY_GUARD,
    roles: [{ roleId: RoleId.SECURITY_GUARD, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function owner(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function makeService(
  overrides: {
    parcel?: Record<string, unknown> | null;
    unit?: { id: string; condoId: string } | null;
  } = {},
) {
  const parcelRow = overrides.parcel ?? {
    id: 'parcel-1',
    condoId: CONDO,
    unitId: UNIT,
    status: ParcelStatus.NOTIFIED,
    notes: null,
  };

  const prisma = {
    unit: {
      findUnique: vi.fn(async () => overrides.unit ?? { id: UNIT, condoId: CONDO }),
    },
    parcel: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'parcel-1',
        ...args.data,
        unit: { id: UNIT, identifier: 'A-01-01', block: { name: 'A' } },
        receivedByGuard: { id: 'guard-1', name: 'Guard' },
        collectedBy: null,
      })),
      findUnique: vi.fn(async () => parcelRow),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...parcelRow,
        ...args.data,
        unit: { id: UNIT, identifier: 'A-01-01', block: { name: 'A' } },
        receivedByGuard: { id: 'guard-1', name: 'Guard' },
        collectedBy: { id: 'owner-1', name: 'Owner' },
      })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: unknown[]) => {
      if (typeof ops[0] === 'function') return (ops[0] as () => unknown)();
      return Promise.all(ops as Array<Promise<unknown>>);
    }),
  } as unknown as PrismaService;

  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  return { service: new ParcelService(prisma, events), prisma, events };
}

describe('ParcelService', () => {
  it('creates a parcel and emits parcel.received', async () => {
    const { service, events } = makeService();
    const result = await service.create(guard(), {
      condoId: CONDO,
      unitId: UNIT,
      recipientName: 'Jane Doe',
      carrier: 'Pos Laju',
    });
    expect(result.recipientName).toBe('Jane Doe');
    expect(events.emit).toHaveBeenCalledWith('parcel.received', {
      parcelId: 'parcel-1',
      condoId: CONDO,
      unitId: UNIT,
    });
  });

  it('rejects collect when already collected', async () => {
    const { service } = makeService({
      parcel: {
        id: 'parcel-1',
        condoId: CONDO,
        unitId: UNIT,
        status: ParcelStatus.COLLECTED,
        notes: null,
      },
    });
    await expect(service.collect(owner(), 'parcel-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks parcel collected for unit owner', async () => {
    const { service, events } = makeService();
    const result = await service.collect(owner(), 'parcel-1', {});
    expect(result.status).toBe(ParcelStatus.COLLECTED);
    expect(events.emit).toHaveBeenCalledWith('parcel.collected', {
      parcelId: 'parcel-1',
      condoId: CONDO,
      unitId: UNIT,
    });
  });

  it('flags overdue parcels and emits parcel.overdue', async () => {
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const { service, events, prisma } = makeService();
    (prisma.parcel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'parcel-1',
        condoId: CONDO,
        unitId: UNIT,
        status: ParcelStatus.NOTIFIED,
        lastOverdueNotifiedAt: null,
        receivedAt: oldDate,
      },
    ]);
    const flagged = await service.detectOverdue();
    expect(flagged).toBe(1);
    expect(events.emit).toHaveBeenCalledWith('parcel.overdue', {
      parcelId: 'parcel-1',
      condoId: CONDO,
      unitId: UNIT,
    });
  });
});
