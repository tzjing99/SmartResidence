import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccountDeletionService } from '../src/users/user-account-deletion.service';

describe('UserAccountDeletionService', () => {
  const user = {
    id: 'user-1',
    roles: [],
  } as never;

  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    session: { updateMany: ReturnType<typeof vi.fn> };
    roleAssignment: { updateMany: ReturnType<typeof vi.fn> };
    ownership: { updateMany: ReturnType<typeof vi.fn> };
    tenancy: { updateMany: ReturnType<typeof vi.fn> };
    householdMember: { deleteMany: ReturnType<typeof vi.fn> };
    favouriteVisitor: { deleteMany: ReturnType<typeof vi.fn> };
    unitVisitorPolicy: { deleteMany: ReturnType<typeof vi.fn> };
    recurringPass: { updateMany: ReturnType<typeof vi.fn> };
    passkeyCredential: { deleteMany: ReturnType<typeof vi.fn> };
    verificationCode: { deleteMany: ReturnType<typeof vi.fn> };
    pushSubscription: { deleteMany: ReturnType<typeof vi.fn> };
    notification: { deleteMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let cache: { invalidateNamespace: ReturnType<typeof vi.fn> };
  let service: UserAccountDeletionService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      session: { updateMany: vi.fn() },
      roleAssignment: { updateMany: vi.fn() },
      ownership: { updateMany: vi.fn() },
      tenancy: { updateMany: vi.fn() },
      householdMember: { deleteMany: vi.fn() },
      favouriteVisitor: { deleteMany: vi.fn() },
      unitVisitorPolicy: { deleteMany: vi.fn() },
      recurringPass: { updateMany: vi.fn() },
      passkeyCredential: { deleteMany: vi.fn() },
      verificationCode: { deleteMany: vi.fn() },
      pushSubscription: { deleteMany: vi.fn() },
      notification: { deleteMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    };
    cache = { invalidateNamespace: vi.fn() };
    service = new UserAccountDeletionService(prisma as never, cache as never);
  });

  it('anonymizes PII, revokes sessions, and deactivates the user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'ACTIVE',
      deletedAt: null,
    });

    const result = await service.deleteAccount(user);

    expect(result.id).toBe('user-1');
    expect(result.status).toBe('deleted');
    expect(result.deletedAt).toBeTruthy();

    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokeReason: 'account-deleted' }),
      }),
    );
    expect(prisma.roleAssignment.updateMany).toHaveBeenCalled();
    expect(prisma.ownership.updateMany).toHaveBeenCalled();
    expect(prisma.tenancy.updateMany).toHaveBeenCalled();
    expect(prisma.householdMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.favouriteVisitor.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.unitVisitorPolicy.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.recurringPass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hostUserId: 'user-1', active: true },
        data: { active: false },
      }),
    );
    expect(prisma.passkeyCredential.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        status: 'DEACTIVATED',
        name: 'Deleted User',
        email: 'deleted+user-1@invalid.local',
        phone: 'deleted:user-1',
        passwordHash: null,
        totpSecret: null,
      }),
    });
    expect(cache.invalidateNamespace).toHaveBeenCalledWith('auth:user:user-1');
  });

  it('rejects already-deleted accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'DEACTIVATED',
      deletedAt: new Date(),
    });

    await expect(service.deleteAccount(user)).rejects.toMatchObject({
      status: 409,
    });
  });
});
