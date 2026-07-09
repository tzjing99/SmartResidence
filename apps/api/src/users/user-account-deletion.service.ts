import { CacheService } from '@/cache/cache.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OwnershipStatus, TenancyStatus, UserStatus } from '@prisma/client';

export interface AccountDeletionResult {
  id: string;
  status: 'deleted';
  deletedAt: string;
}

/**
 * PDPA-oriented account deletion: anonymize PII, soft-deactivate the user,
 * revoke sessions/roles, and end active unit links — while keeping the User
 * row (and payment/audit FKs) for condo billing and history integrity.
 */
@Injectable()
export class UserAccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async deleteAccount(user: AuthenticatedUser): Promise<AccountDeletionResult> {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.deletedAt || existing.status === UserStatus.DEACTIVATED) {
      throw new ConflictException('Account is already deleted');
    }

    const deletedAt = new Date();
    const anonymizedName = 'Deleted User';
    // Unique-safe placeholders so email/phone unique indexes stay free.
    const tombstoneEmail = `deleted+${user.id}@invalid.local`;
    const tombstonePhone = `deleted:${user.id}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: deletedAt, revokeReason: 'account-deleted' },
      });

      await tx.roleAssignment.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: deletedAt },
      });

      await tx.ownership.updateMany({
        where: {
          userId: user.id,
          status: { in: [OwnershipStatus.ACTIVE, OwnershipStatus.PENDING] },
        },
        data: { status: OwnershipStatus.ENDED, endDate: deletedAt },
      });

      await tx.tenancy.updateMany({
        where: {
          userId: user.id,
          status: { in: [TenancyStatus.ACTIVE, TenancyStatus.PENDING] },
        },
        data: { status: TenancyStatus.TERMINATED, endDate: deletedAt },
      });

      // End household membership links (no soft-status on this model).
      await tx.householdMember.deleteMany({ where: { userId: user.id } });

      // Personal address-book / policy rows owned by the user.
      await tx.favouriteVisitor.deleteMany({ where: { userId: user.id } });
      await tx.unitVisitorPolicy.deleteMany({ where: { userId: user.id } });

      // Disable recurring passes; keep rows for gate/security history.
      await tx.recurringPass.updateMany({
        where: { hostUserId: user.id, active: true },
        data: { active: false },
      });

      await tx.passkeyCredential.deleteMany({ where: { userId: user.id } });
      await tx.verificationCode.deleteMany({ where: { userId: user.id } });
      await tx.pushSubscription.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });

      await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.DEACTIVATED,
          deletedAt,
          name: anonymizedName,
          email: tombstoneEmail,
          phone: tombstonePhone,
          avatarUrl: null,
          passwordHash: null,
          totpSecret: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          preferences: {},
          lastSeenAt: null,
        },
      });
    });

    await this.cache.invalidateNamespace(`auth:user:${user.id}`);

    return {
      id: user.id,
      status: 'deleted',
      deletedAt: deletedAt.toISOString(),
    };
  }
}
