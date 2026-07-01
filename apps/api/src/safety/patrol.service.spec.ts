import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { PatrolScanSource, RoleId } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatrolService, isCheckpointOverdue } from './patrol.service';

const CONDO = 'condo-1';
const GUARD_ID = 'guard-1';
const CP_ID = 'cp-1';
const CODE = 'PTRL-ABC123';

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

function checkpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: CP_ID,
    condoId: CONDO,
    name: 'Lobby A',
    description: null,
    code: CODE,
    active: true,
    position: 0,
    expectedIntervalMinutes: 60,
    lastOverdueNotifiedAt: null,
    createdAt: new Date(Date.now() - 10 * 60_000),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('isCheckpointOverdue', () => {
  const now = new Date('2026-07-01T12:00:00Z');

  it('is overdue when the last scan is older than the interval', () => {
    const cp = checkpoint({ expectedIntervalMinutes: 30 });
    const lastScan = new Date(now.getTime() - 45 * 60_000);
    expect(isCheckpointOverdue(cp, lastScan, now)).toBe(true);
  });

  it('is not overdue when scanned within the interval', () => {
    const cp = checkpoint({ expectedIntervalMinutes: 30 });
    const lastScan = new Date(now.getTime() - 10 * 60_000);
    expect(isCheckpointOverdue(cp, lastScan, now)).toBe(false);
  });

  it('never flags checkpoints without an expected interval', () => {
    const cp = checkpoint({ expectedIntervalMinutes: null });
    expect(isCheckpointOverdue(cp, null, now)).toBe(false);
  });

  it('never flags inactive checkpoints', () => {
    const cp = checkpoint({ active: false, expectedIntervalMinutes: 5 });
    expect(isCheckpointOverdue(cp, null, now)).toBe(false);
  });
});

function buildPrisma() {
  const scanCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'scan-1',
    ...data,
  }));
  const cpFindUniqueByCode = vi.fn(async () => checkpoint());
  const cpUpdate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...checkpoint(),
    ...data,
  }));
  const cpFindMany = vi.fn(async () => [] as ReturnType<typeof checkpoint>[]);
  const scanFindMany = vi.fn(async () => [] as Array<{ checkpointId: string; scannedAt: Date }>);

  const prisma = {
    patrolCheckpoint: {
      findUnique: cpFindUniqueByCode,
      update: cpUpdate,
      findMany: cpFindMany,
      create: vi.fn(),
      delete: vi.fn(),
    },
    patrolScan: {
      create: scanCreate,
      findMany: scanFindMany,
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    condo: { findUnique: vi.fn(async () => ({ timezone: 'Asia/Kuala_Lumpur' })) },
    $transaction: vi.fn(async (arg: unknown) => Promise.all(arg as Promise<unknown>[])),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    scanCreate,
    cpFindUniqueByCode,
    cpUpdate,
    cpFindMany,
    scanFindMany,
  };
}

describe('PatrolService', () => {
  let service: PatrolService;
  let built: ReturnType<typeof buildPrisma>;
  let events: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    built = buildPrisma();
    events = { emit: vi.fn() };
    service = new PatrolService(built.prisma, events as unknown as EventEmitter2);
  });

  it('records a scan for a valid active checkpoint code', async () => {
    const scan = await service.scan(guard(), { code: CODE, note: 'All clear' });
    expect(built.scanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkpointId: CP_ID,
          condoId: CONDO,
          guardUserId: GUARD_ID,
          note: 'All clear',
          source: PatrolScanSource.ONLINE,
        }),
      }),
    );
    expect(scan.id).toBe('scan-1');
    expect(events.emit).toHaveBeenCalledWith(
      'patrol.scanned',
      expect.objectContaining({ condoId: CONDO, checkpointId: CP_ID }),
    );
  });

  it('records an offline scan with the client capture time', async () => {
    const scannedAt = new Date('2026-07-01T09:30:00Z').toISOString();
    await service.scan(guard(), { code: CODE, source: PatrolScanSource.OFFLINE, scannedAt });
    expect(built.scanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: PatrolScanSource.OFFLINE }),
      }),
    );
  });

  it('clears the overdue flag when a checkpoint is scanned', async () => {
    built.cpFindUniqueByCode.mockResolvedValueOnce(
      checkpoint({ lastOverdueNotifiedAt: new Date() }) as never,
    );
    await service.scan(guard(), { code: CODE });
    expect(built.cpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastOverdueNotifiedAt: null } }),
    );
  });

  it('rejects an unknown checkpoint code', async () => {
    built.cpFindUniqueByCode.mockResolvedValueOnce(null as never);
    await expect(service.scan(guard(), { code: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects scanning an inactive checkpoint', async () => {
    built.cpFindUniqueByCode.mockResolvedValueOnce(checkpoint({ active: false }) as never);
    await expect(service.scan(guard(), { code: CODE })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('detects overdue checkpoints, notifies once, and de-dupes', async () => {
    const now = new Date();
    const staleCp = checkpoint({
      id: 'cp-stale',
      expectedIntervalMinutes: 30,
      createdAt: new Date(now.getTime() - 90 * 60_000),
      lastOverdueNotifiedAt: null,
    });
    built.cpFindMany.mockResolvedValue([staleCp] as never);
    built.scanFindMany.mockResolvedValue([
      { checkpointId: 'cp-stale', scannedAt: new Date(now.getTime() - 60 * 60_000) },
    ] as never);

    const flagged = await service.detectOverdue(now);
    expect(flagged).toBe(1);
    expect(events.emit).toHaveBeenCalledWith(
      'patrol.overdue',
      expect.objectContaining({ condoId: CONDO, checkpointId: 'cp-stale' }),
    );
    expect(built.cpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cp-stale' },
        data: { lastOverdueNotifiedAt: now },
      }),
    );

    // Already notified within the interval → no duplicate notification.
    events.emit.mockClear();
    built.cpFindMany.mockResolvedValue([
      { ...staleCp, lastOverdueNotifiedAt: new Date(now.getTime() - 5 * 60_000) },
    ] as never);
    const flaggedAgain = await service.detectOverdue(now);
    expect(flaggedAgain).toBe(0);
    expect(events.emit).not.toHaveBeenCalled();
  });
});
