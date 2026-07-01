import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { SetupService } from '@/setup/setup.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import type { PlatformCondoDetail, PlatformCondoSummary } from '@smartresidence/shared-types';

function latestDate(...values: Array<Date | null | undefined>): Date | undefined {
  return values
    .filter((v): v is Date => v instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setup: SetupService,
  ) {}

  async listCondos(
    _user: AuthenticatedUser,
    opts: { search?: string },
  ): Promise<PlatformCondoSummary[]> {
    const search = opts.search?.trim();
    const condos = await this.prisma.condo.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
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
    });
    if (condos.length === 0) return [];

    const condoIds = condos.map((c) => c.id);
    const [unitCounts, gatewayCounts, auditActivity, setupStatuses] = await Promise.all([
      this.prisma.unit.groupBy({
        by: ['condoId'],
        where: { condoId: { in: condoIds } },
        _count: { _all: true },
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
      Promise.all(condos.map((c) => this.setup.buildStatusForCondo(c))),
    ]);

    const unitCountByCondo = new Map(unitCounts.map((r) => [r.condoId, r._count._all]));
    const gatewayCountByCondo = new Map(gatewayCounts.map((r) => [r.condoId, r._count._all]));
    const lastAuditByCondo = new Map(
      auditActivity.map((r) => [r.condoId, r._max.createdAt ?? null]),
    );

    const setupByCondo = new Map(setupStatuses.map((s) => [s.condoId, s]));

    return condos.map((condo) => {
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
        enabledGatewayCount: gatewayCountByCondo.get(condo.id) ?? 0,
        setupCompleted: Boolean(setupStatus?.completedAt),
        setupReady: setupStatus?.ready ?? false,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        createdAt: condo.createdAt.toISOString(),
      };
    });
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
}
