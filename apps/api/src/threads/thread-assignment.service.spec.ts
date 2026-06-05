import type { PrismaService } from '@/prisma/prisma.service';
import { ThreadCategory, ThreadStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ThreadAssignmentService } from './thread-assignment.service';

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

    const svc = new ThreadAssignmentService(prisma);
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

    const svc = new ThreadAssignmentService(prisma);
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

    const svc = new ThreadAssignmentService(prisma);
    const result = await svc.assignOnCreate({
      condoId: 'c1',
      unitId: 'u1',
      createdByUserId: 'r1',
      category: ThreadCategory.MAINTENANCE,
      subject: 'Kitchen sink pipe leaking again',
    });
    expect(result.duplicateSuggestions.some((d) => d.id === 't-dup')).toBe(true);
  });
});
