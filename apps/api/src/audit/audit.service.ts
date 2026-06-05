import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';

export interface AuditQuery {
  unitId?: string;
  condoId?: string;
  resourceType?: string;
  actorUserId?: string;
  action?: AuditAction;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async query(query: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.condoId ? { condoId: query.condoId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  /**
   * Owner-empowerment: every audit row that touches the owner's units.
   * Powers the mobile "Activity on my unit" feed.
   */
  async forOwnerActivityFeed(user: AuthenticatedUser, opts: { limit: number; offset: number }) {
    const unitIds = Array.from(
      new Set(user.roles.map((r) => r.unitId).filter(Boolean) as string[]),
    );
    if (unitIds.length === 0) return { items: [], total: 0, ...opts };

    const where: Prisma.AuditLogWhereInput = { unitId: { in: unitIds } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, ...opts };
  }

  /**
   * Owner-empowerment: "who saw my data" panel.
   *
   * Returns READ-action audit rows scoped to the user's own resources, so the
   * owner can see which staff member opened their unit record / invoice / etc.
   */
  async whoViewedMyData(user: AuthenticatedUser, opts: { limit: number; offset: number }) {
    const unitIds = Array.from(
      new Set(user.roles.map((r) => r.unitId).filter(Boolean) as string[]),
    );
    const where: Prisma.AuditLogWhereInput = {
      action: 'READ',
      OR: [
        ...(unitIds.length ? [{ unitId: { in: unitIds } }] : []),
        { resourceType: 'User', resourceId: user.id },
      ],
      NOT: { actorUserId: user.id },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, ...opts };
  }
}
