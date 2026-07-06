import { CacheService } from '@/cache/cache.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { parseUserPreferences } from '@/auth/user-preferences';

const EXPORT_TTL_SECONDS = 24 * 60 * 60;
const CACHE_PREFIX = 'pdpa:export';

export interface UserDataExportMeta {
  id: string;
  status: 'ready';
  createdAt: string;
  expiresAt: string;
}

export interface UserDataExportBundle {
  exportedAt: string;
  profile: unknown;
  roleAssignments: unknown[];
  units: unknown[];
  threads: unknown[];
  invoices: unknown[];
  payments: unknown[];
  visitors: unknown[];
}

interface StoredExport {
  userId: string;
  bundle: UserDataExportBundle;
}

@Injectable()
export class UserDataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createExport(user: AuthenticatedUser): Promise<UserDataExportMeta> {
    const bundle = await this.buildBundle(user);
    const id = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + EXPORT_TTL_SECONDS * 1000);

    await this.cache.set(
      this.cacheKey(user.id, id),
      { userId: user.id, bundle } satisfies StoredExport,
      EXPORT_TTL_SECONDS,
    );

    return {
      id,
      status: 'ready',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getExport(user: AuthenticatedUser, exportId: string): Promise<UserDataExportBundle> {
    const stored = await this.cache.get<StoredExport>(this.cacheKey(user.id, exportId));
    if (!stored || stored.userId !== user.id) {
      throw new NotFoundException('Export not found or expired');
    }
    return stored.bundle;
  }

  private cacheKey(userId: string, exportId: string): string {
    return `${CACHE_PREFIX}:${userId}:${exportId}`;
  }

  private async buildBundle(user: AuthenticatedUser): Promise<UserDataExportBundle> {
    const unitIds = Array.from(
      new Set(user.roles.map((r) => r.unitId).filter(Boolean) as string[]),
    );

    const [profileRow, roleAssignments, units, threads, invoices, payments, visitors] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            phone: true,
            phoneVerifiedAt: true,
            emailVerifiedAt: true,
            name: true,
            avatarUrl: true,
            locale: true,
            status: true,
            preferences: true,
            lastSeenAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.roleAssignment.findMany({
          where: { userId: user.id, revokedAt: null },
          select: {
            id: true,
            roleId: true,
            condoId: true,
            unitId: true,
            expiresAt: true,
            grantedAt: true,
          },
          orderBy: { grantedAt: 'asc' },
        }),
        unitIds.length > 0
          ? this.prisma.unit.findMany({
              where: { id: { in: unitIds } },
              include: {
                block: { select: { id: true, name: true } },
                condo: { select: { id: true, name: true, slug: true } },
              },
              orderBy: { identifier: 'asc' },
            })
          : Promise.resolve([]),
        this.loadThreads(user.id),
        unitIds.length > 0
          ? this.prisma.invoice.findMany({
              where: { unitId: { in: unitIds } },
              include: { lines: true },
              orderBy: { dueDate: 'desc' },
            })
          : Promise.resolve([]),
        unitIds.length > 0
          ? this.prisma.payment.findMany({
              where: {
                OR: [{ userId: user.id }, { invoice: { unitId: { in: unitIds } } }],
              },
              include: {
                invoice: { select: { id: true, number: true, unitId: true } },
                receipt: { select: { id: true, number: true, issuedAt: true } },
              },
              orderBy: { createdAt: 'desc' },
            })
          : this.prisma.payment.findMany({
              where: { userId: user.id },
              include: {
                invoice: { select: { id: true, number: true, unitId: true } },
                receipt: { select: { id: true, number: true, issuedAt: true } },
              },
              orderBy: { createdAt: 'desc' },
            }),
        this.loadVisitors(user.id, unitIds),
      ]);

    if (!profileRow) throw new NotFoundException('User not found');

    const sessions = await this.prisma.session.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceInfo: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        ...profileRow,
        preferences: parseUserPreferences(profileRow.preferences),
        sessions,
      },
      roleAssignments,
      units,
      threads,
      invoices,
      payments,
      visitors,
    };
  }

  private async loadThreads(userId: string) {
    const participantThreadIds = (
      await this.prisma.threadParticipant.findMany({
        where: { userId },
        select: { threadId: true },
      })
    ).map((p) => p.threadId);

    return this.prisma.thread.findMany({
      where: {
        OR: [{ createdByUserId: userId }, { id: { in: participantThreadIds } }],
      },
      include: {
        messages: {
          select: {
            id: true,
            body: true,
            kind: true,
            authorUserId: true,
            editedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        participants: {
          select: { userId: true, lastReadAt: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadVisitors(userId: string, unitIds: string[]) {
    const orConditions: Array<Record<string, unknown>> = [{ hostUserId: userId }];
    if (unitIds.length > 0) {
      orConditions.push({ unitId: { in: unitIds } });
    }
    return this.prisma.visitor.findMany({
      where: { OR: orConditions },
      include: {
        checkIns: {
          select: {
            id: true,
            checkInAt: true,
            checkOutAt: true,
            checkInGuardId: true,
            notes: true,
          },
          orderBy: { checkInAt: 'asc' },
        },
      },
      orderBy: { expectedAt: 'desc' },
    });
  }
}
