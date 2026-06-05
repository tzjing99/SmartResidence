import type { AuthenticatedUser } from '@/common/types/request-context';
import type { NotificationService } from '@/notification/notification.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleId, ThreadMessageKind, ThreadStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAssistProvider } from './ai/ai-assist.provider';
import { SlaService } from './sla/sla.service';
import { ThreadsService } from './threads.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const RESIDENT_ID = 'resident-1';
const MANAGER_ID = 'manager-1';

function resident(): AuthenticatedUser {
  return {
    id: RESIDENT_ID,
    email: 'r@b.c',
    name: 'Resident',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function manager(): AuthenticatedUser {
  return {
    id: MANAGER_ID,
    email: 'm@b.c',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    condoId: CONDO,
    unitId: UNIT,
    createdByUserId: RESIDENT_ID,
    assignedToUserId: null,
    subject: 'Leaky tap',
    status: ThreadStatus.AWAITING_MANAGEMENT,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    resolutionProposedAt: null,
    resolutionProposedByUserId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Build a Prisma mock whose thread.update calls are captured for assertions. */
function buildPrisma(thread: ReturnType<typeof makeThread>) {
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    thread: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...thread, ...data };
      }),
    },
    threadMessage: { create: vi.fn(async () => ({ id: 'msg-1' })) },
    attachment: { updateMany: vi.fn() },
  };
  const prisma = {
    thread: {
      findUnique: vi.fn(async () => thread),
      update: tx.thread.update,
      findMany: vi.fn(async () => [thread]),
    },
    threadMessage: { create: tx.threadMessage.create },
    threadParticipant: { upsert: vi.fn() },
    roleAssignment: { findMany: vi.fn(async () => [{ userId: MANAGER_ID }]) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return { prisma, updates };
}

function buildService(prisma: ReturnType<typeof buildPrisma>['prisma']) {
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const sla = {
    computeDueDates: vi.fn(async () => ({
      slaPolicyId: null,
      firstResponseDueAt: new Date(),
      resolutionDueAt: new Date(),
    })),
    computeSlaState: vi.fn(() => 'ON_TRACK'),
  } as unknown as SlaService;
  const notifications = { dispatch: vi.fn() } as unknown as NotificationService;
  const ai = { suggestPriority: vi.fn(async () => 'NORMAL') } as unknown as AiAssistProvider;
  return new ThreadsService(prisma as unknown as PrismaService, events, sla, notifications, ai);
}

describe('ThreadsService — D2 resident-driven resolution', () => {
  it('keeps AWAITING_MANAGEMENT when a resident adds a comment (rule 1)', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.postMessage(resident(), thread.id, { body: 'Any update?' });

    expect(updates).toHaveLength(1);
    // The status must NOT be changed by a resident comment while awaiting management.
    expect(updates[0].status).toBeUndefined();
  });

  it('flips OPEN to AWAITING_MANAGEMENT on a resident comment', async () => {
    const thread = makeThread({ status: ThreadStatus.OPEN });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.postMessage(resident(), thread.id, { body: 'Hello?' });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
  });

  it('keeps AWAITING_MANAGEMENT (not AWAITING_RESIDENT) on a plain management reply (rule 3)', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.postMessage(manager(), thread.id, { body: 'Looking into it.' });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
    expect(updates[0].firstRespondedAt).toBeInstanceOf(Date);
  });

  it('blocks management from resolving directly via PATCH', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma } = buildPrisma(thread);
    const service = buildService(prisma);

    await expect(
      service.update(manager(), thread.id, { status: ThreadStatus.RESOLVED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets management propose a resolution (PENDING_RESIDENT_CONFIRMATION)', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.proposeResolution(manager(), thread.id, {});

    expect(updates[0].status).toBe(ThreadStatus.PENDING_RESIDENT_CONFIRMATION);
    expect(updates[0].resolutionProposedByUserId).toBe(MANAGER_ID);
    expect(updates[0].resolutionProposedAt).toBeInstanceOf(Date);
  });

  it('blocks a resident from proposing a resolution', async () => {
    const thread = makeThread();
    const { prisma } = buildPrisma(thread);
    const service = buildService(prisma);

    await expect(service.proposeResolution(resident(), thread.id, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resolves when the resident confirms a proposal (propose → confirm)', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
      resolutionProposedByUserId: MANAGER_ID,
    });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.confirmResolution(resident(), thread.id, { confirmed: true });

    expect(updates[0].status).toBe(ThreadStatus.RESOLVED);
    expect(updates[0].resolvedAt).toBeInstanceOf(Date);
    expect(updates[0].resolutionProposedAt).toBeNull();
  });

  it('reverts to AWAITING_MANAGEMENT when the resident replies during a proposal (propose → reply)', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
      resolutionProposedByUserId: MANAGER_ID,
    });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.postMessage(resident(), thread.id, { body: 'Still dripping.' });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
    expect(updates[0].resolutionProposedAt).toBeNull();
  });

  it('reverts to AWAITING_MANAGEMENT when the resident rejects a proposal', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
      resolutionProposedByUserId: MANAGER_ID,
    });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.confirmResolution(resident(), thread.id, { confirmed: false });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
    expect(updates[0].resolutionProposedAt).toBeNull();
  });

  it('moves to AWAITING_RESIDENT on an explicit management request', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.requestResident(manager(), thread.id, { body: 'Please share a photo.' });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_RESIDENT);
  });

  it('moves an AWAITING_RESIDENT thread back to AWAITING_MANAGEMENT on resident reply', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_RESIDENT });
    const { prisma, updates } = buildPrisma(thread);
    const service = buildService(prisma);

    await service.postMessage(resident(), thread.id, { body: 'Here is the photo.' });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
  });
});

describe('SlaService — 7-day resolution auto-close', () => {
  let prisma: ReturnType<typeof buildPrisma>['prisma'];
  let updates: Array<Record<string, unknown>>;

  beforeEach(() => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: old,
      resolutionProposedByUserId: MANAGER_ID,
    });
    ({ prisma, updates } = buildPrisma(thread));
  });

  it('auto-resolves a proposal that the resident ignored past the window', async () => {
    const events = { emit: vi.fn() } as unknown as EventEmitter2;
    const notifications = { dispatch: vi.fn() } as unknown as NotificationService;
    const sla = new SlaService(prisma as unknown as PrismaService, events, notifications);

    await sla.scanForResolutionAutoConfirm();

    expect(prisma.thread.findMany).toHaveBeenCalled();
    expect(updates[0].status).toBe(ThreadStatus.RESOLVED);
    expect(updates[0].resolvedAt).toBeInstanceOf(Date);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(notifications.dispatch).toHaveBeenCalled();
    expect(prisma.threadMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: ThreadMessageKind.SYSTEM }),
      }),
    );
  });

  it('uses a 7-day confirmation window constant', () => {
    expect(SlaService.RESOLUTION_CONFIRMATION_WINDOW_DAYS).toBe(7);
  });
});
