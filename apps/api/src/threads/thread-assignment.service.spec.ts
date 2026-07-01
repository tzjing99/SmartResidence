import type { PrismaService } from '@/prisma/prisma.service';
import { ThreadCategory, ThreadPriority } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RuleBasedAssignmentAssistProvider } from './ai/assignment-assist.provider';
import { ThreadAssignmentService } from './thread-assignment.service';

function helpdeskPrisma(settings: Record<string, unknown>) {
  return {
    condo: { findUnique: vi.fn(async () => ({ settings })) },
    thread: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    roleAssignment: {
      findMany: vi.fn(async ({ where }: { where: { userId?: { in: string[] } } }) =>
        (where.userId?.in ?? []).map((userId) => ({ userId })),
      ),
    },
  } as unknown as PrismaService;
}

function buildService(prisma: PrismaService) {
  return new ThreadAssignmentService(prisma, new RuleBasedAssignmentAssistProvider());
}

describe('ThreadAssignmentService', () => {
  it('routes GENERAL category to general triage pool', async () => {
    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({
          settings: {
            helpdesk: {
              autoAssignment: {
                generalTriagePool: ['mgr-1', 'mgr-2'],
                categoryPools: [],
                seniorStaffPool: [],
              },
            },
          },
        })),
      },
      thread: {
        count: vi.fn(async () => 0),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      roleAssignment: {
        findMany: vi.fn(async () => [{ userId: 'mgr-1' }, { userId: 'mgr-2' }]),
      },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    const result = await svc.assignOnCreate({
      condoId: 'c1',
      unitId: 'u1',
      createdByUserId: 'r1',
      category: ThreadCategory.GENERAL,
      subject: 'Noise complaint',
    });
    expect(result.assignedToUserId).toBe('mgr-1');
  });

  it('flags repeat complainants with 3+ threads in 30 days', async () => {
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ settings: {} })) },
      thread: {
        count: vi.fn(async () => 3),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      roleAssignment: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    const result = await svc.assignOnCreate({
      condoId: 'c1',
      unitId: 'u1',
      createdByUserId: 'r1',
      category: ThreadCategory.COMPLAINT,
      subject: 'Another issue',
    });
    expect(result.repeatComplainant).toBe(true);
  });

  it('suggests duplicate threads with similar title', async () => {
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ settings: {} })) },
      thread: {
        count: vi.fn(async () => 0),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => [
          {
            id: 't-dup',
            subject: 'Leaking pipe kitchen sink',
            category: ThreadCategory.MAINTENANCE,
          },
        ]),
      },
      roleAssignment: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    const result = await svc.assignOnCreate({
      condoId: 'c1',
      unitId: 'u1',
      createdByUserId: 'r1',
      category: ThreadCategory.MAINTENANCE,
      subject: 'Kitchen sink pipe leaking again',
    });
    expect(result.duplicateSuggestions.some((d) => d.id === 't-dup')).toBe(true);
  });

  it('assignOnPriorityChange routes URGENT to seniorStaffPool', async () => {
    const prisma = helpdeskPrisma({
      helpdesk: {
        autoAssignment: {
          generalTriagePool: [],
          categoryPools: [{ category: ThreadCategory.MAINTENANCE, userIds: ['staff-1'] }],
          seniorStaffPool: ['senior-1', 'senior-2'],
        },
      },
    });

    const svc = buildService(prisma);
    const assignee = await svc.assignOnPriorityChange(
      'c1',
      ThreadPriority.URGENT,
      false,
      ThreadCategory.MAINTENANCE,
      'staff-1',
    );
    expect(assignee).toBe('senior-1');
  });

  it('assignOnPriorityChange uses explicit priorityPools over seniorStaffPool', async () => {
    const prisma = helpdeskPrisma({
      helpdesk: {
        autoAssignment: {
          generalTriagePool: [],
          categoryPools: [],
          seniorStaffPool: ['senior-1'],
          priorityPools: [{ priority: ThreadPriority.HIGH, userIds: ['oncall-1'] }],
        },
      },
    });

    const svc = buildService(prisma);
    const assignee = await svc.assignOnPriorityChange(
      'c1',
      ThreadPriority.HIGH,
      false,
      ThreadCategory.COMPLAINT,
      null,
    );
    expect(assignee).toBe('oncall-1');
  });

  it('assignOnPriorityChange de-escalation routes NORMAL to category pool', async () => {
    const prisma = helpdeskPrisma({
      helpdesk: {
        autoAssignment: {
          generalTriagePool: [],
          categoryPools: [{ category: ThreadCategory.MAINTENANCE, userIds: ['staff-1'] }],
          seniorStaffPool: ['senior-1'],
        },
      },
    });

    const svc = buildService(prisma);
    const assignee = await svc.assignOnPriorityChange(
      'c1',
      ThreadPriority.NORMAL,
      false,
      ThreadCategory.MAINTENANCE,
      'senior-1',
    );
    expect(assignee).toBe('staff-1');
  });

  it('assignOnPriorityChange keeps current assignee when no pool matches', async () => {
    const prisma = helpdeskPrisma({
      helpdesk: {
        autoAssignment: {
          generalTriagePool: [],
          categoryPools: [],
          seniorStaffPool: [],
        },
      },
    });

    const svc = buildService(prisma);
    const assignee = await svc.assignOnPriorityChange(
      'c1',
      ThreadPriority.URGENT,
      false,
      ThreadCategory.COMPLAINT,
      'staff-9',
    );
    expect(assignee).toBe('staff-9');
  });
});
