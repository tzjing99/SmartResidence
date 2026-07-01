import type { AuthenticatedUser } from '@/common/types/request-context';
import type { NotificationService } from '@/notification/notification.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotificationKind,
  RoleId,
  ThreadCategory,
  ThreadPriority,
  ThreadStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAssistProvider } from './ai/ai-assist.provider';
import { SlaService } from './sla/sla.service';
import type { ThreadAssignmentService } from './thread-assignment.service';
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
    category: ThreadCategory.MAINTENANCE,
    priority: ThreadPriority.NORMAL,
    status: ThreadStatus.AWAITING_MANAGEMENT,
    metadata: {},
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    resolutionProposedAt: null,
    resolutionProposedByUserId: null,
    resolutionProposedMessageId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildPrisma(thread: ReturnType<typeof makeThread>) {
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    thread: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...thread, ...data };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'thread-new',
        ...data,
      })),
    },
    threadMessage: { create: vi.fn(async () => ({ id: 'msg-1' })) },
    attachment: { updateMany: vi.fn() },
    unit: { findUnique: vi.fn(async () => ({ id: UNIT, condoId: CONDO })) },
  };
  const prisma = {
    thread: {
      findUnique: vi.fn(async () => thread),
      update: tx.thread.update,
      findMany: vi.fn(async () => [thread]),
      create: tx.thread.create,
      count: vi.fn(async () => 0),
    },
    threadMessage: {
      create: tx.threadMessage.create,
      findFirst: vi.fn(async () => null),
    },
    threadParticipant: { upsert: vi.fn() },
    roleAssignment: { findMany: vi.fn(async () => [{ userId: MANAGER_ID }]) },
    auditLog: { create: vi.fn() },
    unit: { findUnique: vi.fn(async () => ({ id: UNIT, condoId: CONDO })) },
    condo: { findUnique: vi.fn(async () => ({ id: CONDO, settings: {} })) },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return { prisma, updates, tx };
}

function buildAssignment(
  overrides: Partial<ThreadAssignmentService> = {},
): ThreadAssignmentService {
  return {
    assignOnCreate: vi.fn(async () => ({
      assignedToUserId: null,
      repeatComplainant: false,
      duplicateSuggestions: [],
    })),
    assignOnRecategorise: vi.fn(async () => null),
    assignOnPriorityChange: vi.fn(async (_c, _p, _r, _cat, current) => current),
    ...overrides,
  } as unknown as ThreadAssignmentService;
}

function buildService(
  prisma: ReturnType<typeof buildPrisma>['prisma'],
  assignmentOverrides: Partial<ThreadAssignmentService> = {},
) {
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
  const ai = {
    suggestPriority: vi.fn(async () => ({ priority: 'NORMAL', source: 'rules' })),
  } as unknown as AiAssistProvider;
  const service = new ThreadsService(
    prisma as unknown as PrismaService,
    events,
    sla,
    notifications,
    buildAssignment(assignmentOverrides),
    ai,
  );
  return { service, notifications };
}

describe('ThreadsService — M1 resolution flow', () => {
  it('keeps AWAITING_MANAGEMENT when a resident adds a comment (rule 1)', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma, updates } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await service.postMessage(resident(), thread.id, { body: 'Any update?' });

    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBeUndefined();
  });

  it('blocks propose-resolve while AWAITING_RESIDENT (B13)', async () => {
    const thread = makeThread({
      status: ThreadStatus.AWAITING_RESIDENT,
      firstRespondedAt: new Date(),
    });
    const { prisma } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await expect(service.proposeResolution(manager(), thread.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks propose-resolve before management has responded', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT, firstRespondedAt: null });
    const { prisma } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await expect(service.proposeResolution(manager(), thread.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lets management propose after responding (B6)', async () => {
    const thread = makeThread({
      status: ThreadStatus.AWAITING_MANAGEMENT,
      firstRespondedAt: new Date(),
    });
    const { prisma, updates } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await service.proposeResolution(manager(), thread.id, {});

    expect(updates[0].status).toBe(ThreadStatus.PENDING_RESIDENT_CONFIRMATION);
  });

  it('confirms resolution and closes ticket (B2)', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
      resolutionProposedByUserId: MANAGER_ID,
    });
    const { prisma, updates } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await service.confirmResolution(resident(), thread.id, { confirmed: true });

    expect(updates[0].status).toBe(ThreadStatus.RESOLVED);
    expect(updates[0].resolvedAt).toBeInstanceOf(Date);
    expect(updates[0].resolutionProposedAt).toBeNull();
    expect(updates[0].resolutionProposedByUserId).toBeNull();
  });

  it('requires reject reason and expectation (B3)', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
    });
    const { prisma } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await expect(
      service.confirmResolution(resident(), thread.id, { confirmed: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects with structured feedback', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
    });
    const { prisma, updates } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await service.confirmResolution(resident(), thread.id, {
      confirmed: false,
      rejectReason: 'Tap still dripping',
      rejectExpectation: 'Please send a plumber',
    });

    expect(updates[0].status).toBe(ThreadStatus.AWAITING_MANAGEMENT);
  });

  it('blocks resident reply during pending confirmation (use reject form)', async () => {
    const thread = makeThread({
      status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
      resolutionProposedAt: new Date(),
    });
    const { prisma } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await expect(
      service.postMessage(resident(), thread.id, { body: 'Still dripping.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('appeal requires reason text (B10)', async () => {
    const thread = makeThread({ status: ThreadStatus.RESOLVED, assignedToUserId: MANAGER_ID });
    const { prisma, updates } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await service.appeal(resident(), thread.id, {
      reason: 'Issue came back after two days',
    });

    expect(updates[0].status).toBe(ThreadStatus.REOPENED);
    expect(updates[0].reopenCount).toEqual({ increment: 1 });
  });

  it('blocks management from resolving directly via PATCH', async () => {
    const thread = makeThread({ status: ThreadStatus.AWAITING_MANAGEMENT });
    const { prisma } = buildPrisma(thread);
    const { service } = buildService(prisma);

    await expect(
      service.update(manager(), thread.id, { status: ThreadStatus.RESOLVED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ThreadsService — M2 priority change assignment', () => {
  it('auto-reassigns and notifies when priority escalates', async () => {
    const thread = makeThread({
      assignedToUserId: 'staff-1',
      priority: ThreadPriority.NORMAL,
    });
    const { prisma, updates, tx } = buildPrisma(thread);
    const { service, notifications } = buildService(prisma, {
      assignOnPriorityChange: vi.fn(async () => 'senior-1'),
    });

    await service.update(manager(), thread.id, { priority: ThreadPriority.URGENT });

    expect(updates[0].priority).toBe(ThreadPriority.URGENT);
    expect(updates[0].assignedTo).toEqual({ connect: { id: 'senior-1' } });
    expect(tx.threadMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining('Auto-reassigned after priority change'),
        }),
      }),
    );
    expect(notifications.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['senior-1'],
        kind: NotificationKind.THREAD_ASSIGNED,
      }),
    );
  });
});

describe('SlaService — resolution auto-confirm', () => {
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
    prisma.thread.findMany = vi.fn(async () => [
      {
        ...thread,
        messages: [{ authorUserId: MANAGER_ID, createdAt: old }],
      },
    ]);
    prisma.roleAssignment.findMany = vi.fn(async () => [{ userId: MANAGER_ID }]);
  });

  it('auto-resolves silent proposals past grace window', async () => {
    const events = { emit: vi.fn() } as unknown as EventEmitter2;
    const notifications = { dispatch: vi.fn() } as unknown as NotificationService;
    const sla = new SlaService(prisma as unknown as PrismaService, events, notifications);

    await sla.scanForResolutionAutoConfirm();

    expect(updates[0].status).toBe(ThreadStatus.RESOLVED);
    expect(notifications.dispatch).toHaveBeenCalled();
  });

  it('uses default 7-day grace constant', () => {
    expect(SlaService.RESOLUTION_CONFIRMATION_WINDOW_DAYS).toBe(7);
  });
});
