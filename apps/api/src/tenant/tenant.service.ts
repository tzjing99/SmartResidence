import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { buildUnitListWhere, normalizeUnitSearchTerm } from './unit-search';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyCondos(user: AuthenticatedUser) {
    const condoIds = Array.from(
      new Set(user.roles.map((r) => r.condoId).filter(Boolean) as string[]),
    );
    if (condoIds.length === 0) return [];
    return this.prisma.condo.findMany({
      where: { id: { in: condoIds } },
      orderBy: { name: 'asc' },
    });
  }

  async getCondo(condoId: string) {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      include: {
        _count: { select: { units: true, blocks: true } },
      },
    });
    if (!condo) throw new NotFoundException('Condo not found');
    return condo;
  }

  async listUnits(condoId: string, opts: { limit: number; offset: number; search?: string }) {
    const term = opts.search ? normalizeUnitSearchTerm(opts.search) : undefined;
    const where = buildUnitListWhere(condoId, term);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        include: {
          block: true,
          ownerships: { where: { status: 'ACTIVE' }, include: { user: true } },
        },
        orderBy: [{ block: { position: 'asc' } }, { identifier: 'asc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async listBlocks(condoId: string) {
    return this.prisma.block.findMany({
      where: { condoId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, position: true },
    });
  }

  async getMyUnits(user: AuthenticatedUser) {
    const unitIds = Array.from(
      new Set(user.roles.map((r) => r.unitId).filter(Boolean) as string[]),
    );
    if (unitIds.length === 0) return [];
    return this.prisma.unit.findMany({
      where: { id: { in: unitIds } },
      include: { block: true, condo: true },
      orderBy: { identifier: 'asc' },
    });
  }
}
