import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataExportService } from '../src/users/user-data-export.service';

describe('UserDataExportService', () => {
  const user = {
    id: 'user-1',
    roles: [{ roleId: 'UNIT_OWNER', condoId: 'c1', unitId: 'unit-1', permissions: [] }],
  } as never;

  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    roleAssignment: { findMany: ReturnType<typeof vi.fn> };
    unit: { findMany: ReturnType<typeof vi.fn> };
    invoice: { findMany: ReturnType<typeof vi.fn> };
    payment: { findMany: ReturnType<typeof vi.fn> };
    visitor: { findMany: ReturnType<typeof vi.fn> };
    threadParticipant: { findMany: ReturnType<typeof vi.fn> };
    thread: { findMany: ReturnType<typeof vi.fn> };
    session: { findMany: ReturnType<typeof vi.fn> };
  };
  let cache: { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  let service: UserDataExportService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          id: 'user-1',
          email: 'a@b.c',
          phone: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: null,
          name: 'Ada',
          avatarUrl: null,
          locale: 'en',
          status: 'ACTIVE',
          preferences: {},
          lastSeenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      roleAssignment: { findMany: vi.fn(async () => []) },
      unit: { findMany: vi.fn(async () => []) },
      invoice: { findMany: vi.fn(async () => []) },
      payment: { findMany: vi.fn(async () => []) },
      visitor: { findMany: vi.fn(async () => []) },
      threadParticipant: { findMany: vi.fn(async () => []) },
      thread: { findMany: vi.fn(async () => []) },
      session: { findMany: vi.fn(async () => []) },
    };
    cache = { set: vi.fn(), get: vi.fn() };
    service = new UserDataExportService(prisma as never, cache as never);
  });

  it('scopes payments and visitors to the exporting user only', async () => {
    await service.createExport(user);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
    expect(prisma.visitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hostUserId: 'user-1' },
      }),
    );
  });

  it('rejects download when export belongs to another user', async () => {
    cache.get.mockResolvedValueOnce(null);
    await expect(service.getExport(user, '00000000-0000-4000-8000-000000000001')).rejects.toThrow(
      /not found/i,
    );
  });
});
