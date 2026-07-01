import { CacheService } from '@/cache/cache.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, NotificationKind, Prisma, RoleId } from '@prisma/client';
import { isValidMalaysiaPhone, normalizeMalaysiaPhone } from '@smartresidence/shared-types';
import { UpdateResidentContactDto } from './dto/tenant.dto';
import { buildUnitListWhere, normalizeUnitSearchTerm } from './unit-search';

/** Condo + block reference data changes rarely; short TTL keeps it fresh enough. */
const CONDO_TTL = 300;
const BLOCKS_TTL = 300;

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationService,
  ) {}

  async listMyCondos(user: AuthenticatedUser) {
    const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (isSuperAdmin) {
      return this.prisma.condo.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }
    const condoIds = Array.from(
      new Set(user.roles.map((r) => r.condoId).filter(Boolean) as string[]),
    );
    if (condoIds.length === 0) return [];
    return this.prisma.condo.findMany({
      where: { id: { in: condoIds }, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getCondo(condoId: string) {
    const condo = await this.cache.wrap(`condo:${condoId}`, CONDO_TTL, () =>
      this.prisma.condo.findUnique({
        where: { id: condoId },
        include: {
          _count: { select: { units: true, blocks: true } },
        },
      }),
    );
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
    return this.cache.wrap(`blocks:${condoId}`, BLOCKS_TTL, () =>
      this.prisma.block.findMany({
        where: { condoId },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, position: true },
      }),
    );
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

  async viewResidentContact(actor: AuthenticatedUser, unitId: string, userId: string) {
    const membership = await this.findActiveResidentOnUnit(unitId, userId);
    this.assertManagement(actor, membership.unit.condoId);
    await this.recordResidentRead(actor, membership.unit.condoId, unitId, userId);
    return this.toResidentContactView(membership);
  }

  async updateResidentContact(
    actor: AuthenticatedUser,
    unitId: string,
    userId: string,
    dto: UpdateResidentContactDto,
  ) {
    const membership = await this.findActiveResidentOnUnit(unitId, userId);
    this.assertManagement(actor, membership.unit.condoId);

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) {
      const phone = normalizeMalaysiaPhone(dto.phone);
      if (!isValidMalaysiaPhone(phone)) {
        throw new BadRequestException(
          'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
        );
      }
      data.phone = phone;
    }
    if (Object.keys(data).length === 0) return this.viewResidentContact(actor, unitId, userId);

    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Email or phone already in use');
      }
      throw err;
    }

    await this.prisma.auditLog.create({
      data: {
        condoId: membership.unit.condoId,
        unitId,
        actorUserId: actor.id,
        actorRole: actor.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'User',
        resourceId: userId,
        metadata: {
          reason: 'management_resident_contact_update',
          fields: Object.keys(data),
        },
      },
    });

    return this.viewResidentContact(actor, unitId, userId);
  }

  private async findActiveResidentOnUnit(unitId: string, userId: string) {
    const ownership = await this.prisma.ownership.findFirst({
      where: { unitId, userId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, locale: true } },
        unit: { include: { block: true, condo: true } },
      },
    });
    if (ownership) return ownership;

    const tenancy = await this.prisma.tenancy.findFirst({
      where: { unitId, userId, status: 'ACTIVE', endDate: null },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, locale: true } },
        unit: { include: { block: true, condo: true } },
      },
    });
    if (tenancy) {
      return {
        id: tenancy.id,
        userId: tenancy.userId,
        user: tenancy.user,
        unit: tenancy.unit,
        kind: 'TENANT',
      };
    }
    throw new NotFoundException('Resident is not active on this unit');
  }

  private toResidentContactView(membership: {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string | null; phone: string | null; locale: string };
    unit: { id: string; identifier: string; condoId: string; block?: { name: string } | null };
  }) {
    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      locale: membership.user.locale,
      unit: {
        id: membership.unit.id,
        identifier: membership.unit.identifier,
        block: membership.unit.block,
      },
    };
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    const allowed = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
    if (!allowed) throw new ForbiddenException('Only management can access resident records');
  }

  private async recordResidentRead(
    actor: AuthenticatedUser,
    condoId: string,
    unitId: string,
    residentUserId: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        actorUserId: actor.id,
        actorRole: actor.activeRole,
        action: AuditAction.READ,
        resourceType: 'User',
        resourceId: residentUserId,
        metadata: { reason: 'management_resident_profile_view' },
      },
    });
    await this.notifications.dispatch({
      userIds: [residentUserId],
      kind: NotificationKind.AUDIT_ALERT,
      title: 'Management viewed your resident profile',
      body: `${actor.name} opened your contact details for unit management.`,
      data: { unitId, actorUserId: actor.id },
    });
  }
}
