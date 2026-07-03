import type { PaginatedResult } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { SetupService } from '@/setup/setup.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, DefectStatus, InvoiceStatus, RoleId, type Prisma } from '@prisma/client';
import type {
  CreatePlatformCondoResult,
  PlatformCondoDetail,
  PlatformCondoHealth,
  PlatformCondoSummary,
} from '@smartresidence/shared-types';

const CLOSED_DEFECT_STATUSES: DefectStatus[] = [DefectStatus.CLOSED, DefectStatus.RESOLVED];

function latestDate(...values: Array<Date | null | undefined>): Date | undefined {
  return values
    .filter((v): v is Date => v instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function overdueInvoiceWhere(now: Date): Prisma.InvoiceWhereInput {
  return {
    OR: [
      { status: InvoiceStatus.OVERDUE },
      {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        dueDate: { lt: now },
      },
    ],
  };
}

function countDistinctUsers(
  rows: Array<{ condoId: string | null; userId: string }>,
): Map<string, number> {
  const byCondo = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.condoId) continue;
    const set = byCondo.get(row.condoId) ?? new Set<string>();
    set.add(row.userId);
    byCondo.set(row.condoId, set);
  }
  return new Map([...byCondo.entries()].map(([condoId, users]) => [condoId, users.size]));
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setup: SetupService,
  ) {}

  async listCondos(
    _user: AuthenticatedUser,
    opts: { search?: string; limit: number; offset: number },
  ): Promise<PaginatedResult<PlatformCondoSummary>> {
    const search = opts.search?.trim();
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
              { address: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, condos] = await this.prisma.$transaction([
      this.prisma.condo.count({ where }),
      this.prisma.condo.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.offset,
        take: opts.limit,
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          countryCode: true,
          timezone: true,
          settings: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    if (condos.length === 0) {
      return { items: [], total, limit: opts.limit, offset: opts.offset };
    }

    const condoIds = condos.map((c) => c.id);
    const now = new Date();
    const [
      unitCounts,
      userAssignments,
      gatewayCounts,
      auditActivity,
      openDefectCounts,
      overdueInvoiceCounts,
      setupStatuses,
    ] = await Promise.all([
      this.prisma.unit.groupBy({
        by: ['condoId'],
        where: { condoId: { in: condoIds } },
        _count: { _all: true },
      }),
      this.prisma.roleAssignment.groupBy({
        by: ['condoId', 'userId'],
        where: { condoId: { in: condoIds }, revokedAt: null },
      }),
      this.prisma.paymentGatewayConnection.groupBy({
        by: ['condoId'],
        where: { condoId: { in: condoIds }, enabled: true },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['condoId'],
        where: { condoId: { in: condoIds } },
        _max: { createdAt: true },
      }),
      this.prisma.defect.groupBy({
        by: ['condoId'],
        where: {
          condoId: { in: condoIds },
          status: { notIn: CLOSED_DEFECT_STATUSES },
        },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['condoId'],
        where: { condoId: { in: condoIds }, ...overdueInvoiceWhere(now) },
        _count: { _all: true },
      }),
      Promise.all(condos.map((c) => this.setup.buildStatusForCondo(c))),
    ]);

    const unitCountByCondo = new Map(unitCounts.map((r) => [r.condoId, r._count._all]));
    const userCountByCondo = countDistinctUsers(userAssignments);
    const gatewayCountByCondo = new Map(gatewayCounts.map((r) => [r.condoId, r._count._all]));
    const lastAuditByCondo = new Map(
      auditActivity.map((r) => [r.condoId, r._max.createdAt ?? null]),
    );
    const openDefectByCondo = new Map(openDefectCounts.map((r) => [r.condoId, r._count._all]));
    const overdueInvoiceByCondo = new Map(
      overdueInvoiceCounts.map((r) => [r.condoId, r._count?._all ?? 0]),
    );
    const setupByCondo = new Map(setupStatuses.map((s) => [s.condoId, s]));

    const items = condos.map((condo) => {
      const setupStatus = setupByCondo.get(condo.id);
      const lastAudit = lastAuditByCondo.get(condo.id) ?? null;
      const lastActivityAt = latestDate(lastAudit, condo.updatedAt);

      return {
        id: condo.id,
        slug: condo.slug,
        name: condo.name,
        address: condo.address,
        countryCode: condo.countryCode,
        timezone: condo.timezone,
        unitCount: unitCountByCondo.get(condo.id) ?? 0,
        userCount: userCountByCondo.get(condo.id) ?? 0,
        enabledGatewayCount: gatewayCountByCondo.get(condo.id) ?? 0,
        setupCompleted: Boolean(setupStatus?.completedAt),
        setupReady: setupStatus?.ready ?? false,
        openDefectCount: openDefectByCondo.get(condo.id) ?? 0,
        overdueInvoiceCount: overdueInvoiceByCondo.get(condo.id) ?? 0,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        createdAt: condo.createdAt.toISOString(),
      };
    });

    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getCondoSummary(user: AuthenticatedUser, condoId: string): Promise<PlatformCondoDetail> {
    const condo = await this.prisma.condo.findFirst({
      where: { id: condoId, deletedAt: null },
    });
    if (!condo) throw new NotFoundException('Condo not found');

    const [
      unitCount,
      blockCount,
      residentCount,
      managementCount,
      enabledGatewayCount,
      lastAudit,
      setup,
    ] = await Promise.all([
      this.prisma.unit.count({ where: { condoId } }),
      this.prisma.block.count({ where: { condoId } }),
      this.prisma.roleAssignment.count({
        where: {
          condoId,
          revokedAt: null,
          roleId: { in: [RoleId.UNIT_OWNER, RoleId.TENANT] },
        },
      }),
      this.prisma.roleAssignment.count({
        where: {
          condoId,
          revokedAt: null,
          roleId: { in: [RoleId.MANAGEMENT_ADMIN, RoleId.MANAGEMENT_STAFF] },
        },
      }),
      this.prisma.paymentGatewayConnection.count({ where: { condoId, enabled: true } }),
      this.prisma.auditLog.aggregate({
        where: { condoId },
        _max: { createdAt: true },
      }),
      this.setup.getStatus(user, condoId),
    ]);

    const lastActivityAt = latestDate(lastAudit._max.createdAt, condo.updatedAt);

    return {
      id: condo.id,
      slug: condo.slug,
      name: condo.name,
      address: condo.address,
      countryCode: condo.countryCode,
      currencyCode: condo.currencyCode,
      timezone: condo.timezone,
      locale: condo.locale,
      brandColor: condo.brandColor,
      logoUrl: condo.logoUrl,
      createdAt: condo.createdAt.toISOString(),
      updatedAt: condo.updatedAt.toISOString(),
      unitCount,
      blockCount,
      residentCount,
      managementCount,
      enabledGatewayCount,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      setup,
    };
  }

  async getCondoHealth(_user: AuthenticatedUser, condoId: string): Promise<PlatformCondoHealth> {
    const condo = await this.prisma.condo.findFirst({
      where: { id: condoId, deletedAt: null },
    });
    if (!condo) throw new NotFoundException('Condo not found');

    const now = new Date();
    const [
      unitCount,
      userAssignments,
      openDefectCount,
      overdueInvoices,
      lastAudit,
      recentAuditEvents,
      setupStatus,
    ] = await Promise.all([
      this.prisma.unit.count({ where: { condoId } }),
      this.prisma.roleAssignment.groupBy({
        by: ['userId'],
        where: { condoId, revokedAt: null },
      }),
      this.prisma.defect.count({
        where: { condoId, status: { notIn: CLOSED_DEFECT_STATUSES } },
      }),
      this.prisma.invoice.findMany({
        where: { condoId, ...overdueInvoiceWhere(now) },
        select: { total: true, amountPaid: true },
      }),
      this.prisma.auditLog.aggregate({
        where: { condoId },
        _max: { createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { condoId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.setup.buildStatusForCondo(condo),
    ]);

    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
      0,
    );
    const lastActivityAt = latestDate(lastAudit._max.createdAt, condo.updatedAt);

    return {
      condoId: condo.id,
      userCount: userAssignments.length,
      unitCount,
      openDefectCount,
      billing: {
        overdueInvoiceCount: overdueInvoices.length,
        overdueAmount,
        currencyCode: condo.currencyCode,
      },
      recentAuditEvents: recentAuditEvents.map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        actorName: row.actor?.name ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      setupCompleted: Boolean(setupStatus.completedAt),
      setupReady: setupStatus.ready,
    };
  }

  async provisionCondo(
    user: AuthenticatedUser,
    input: { name: string; slug: string; address: string; timezone: string },
  ): Promise<CreatePlatformCondoResult> {
    const slug = input.slug.trim().toLowerCase();
    const name = input.name.trim();
    const address = input.address.trim();
    const timezone = input.timezone.trim();

    if (!name || !address || !timezone) {
      throw new BadRequestException('Name, address, and timezone are required');
    }

    const existing = await this.prisma.condo.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('A condo with this slug already exists');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const condo = await tx.condo.create({
        data: {
          slug,
          name,
          address,
          timezone,
        },
      });

      await tx.auditLog.create({
        data: {
          condoId: condo.id,
          actorUserId: user.id,
          actorRole: user.activeRole ?? RoleId.SUPER_ADMIN,
          action: AuditAction.CREATE,
          resourceType: 'Condo',
          resourceId: condo.id,
          metadata: { slug, name, source: 'platform.provision' },
        },
      });

      return condo;
    });

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      address: created.address,
      timezone: created.timezone,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
