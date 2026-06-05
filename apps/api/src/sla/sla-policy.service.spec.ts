import type { AuthenticatedUser } from '@/common/types/request-context';
import type { AnnouncementService } from '@/announcement/announcement.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { SlaService } from '@/threads/sla/sla.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleId, ThreadPriority } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SlaPolicyService } from './sla-policy.service';

const CONDO = 'condo-1';

function admin(): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'a@b.c',
    name: 'Admin',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function staff(): AuthenticatedUser {
  return {
    id: 'staff-1',
    email: 's@b.c',
    name: 'Staff',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_STAFF,
    roles: [{ roleId: RoleId.MANAGEMENT_STAFF, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

describe('SlaPolicyService', () => {
  it('blocks staff from updating SLA policies', async () => {
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: CONDO, settings: {}, timezone: 'UTC' })) },
      unit: { count: vi.fn(async () => 50) },
      slaPolicy: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService;
    const svc = new SlaPolicyService(
      prisma,
      {} as SlaService,
      {} as AnnouncementService,
      {} as EventEmitter2,
    );

    await expect(
      svc.updateSettings(staff(), CONDO, {
        policies: [{ priority: ThreadPriority.NORMAL, resolutionMins: 4320 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires risky acknowledgment when saving risky band', async () => {
    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({ id: CONDO, settings: {}, timezone: 'Asia/Kuala_Lumpur' })),
      },
      unit: { count: vi.fn(async () => 50) },
      slaPolicy: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService;
    const svc = new SlaPolicyService(
      prisma,
      { recalculateOpenThreadDueDates: vi.fn() } as unknown as SlaService,
      {} as AnnouncementService,
      { emit: vi.fn() } as unknown as EventEmitter2,
    );

    await expect(
      svc.updateSettings(admin(), CONDO, {
        policies: [{ priority: ThreadPriority.URGENT, resolutionMins: 60 * 24 * 14 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
