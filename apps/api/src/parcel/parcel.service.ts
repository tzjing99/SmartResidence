import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, type Parcel, ParcelStatus, type Prisma, RoleId } from '@prisma/client';
import { PARCEL_OVERDUE_DAYS } from '@smartresidence/shared-types';
import type { CollectParcelDto, CreateParcelDto, ListParcelsDto } from './dto/parcel.dto';

const parcelInclude = {
  unit: { select: { id: true, identifier: true, block: { select: { name: true } } } },
  receivedByGuard: { select: { id: true, name: true } },
  collectedBy: { select: { id: true, name: true } },
} satisfies Prisma.ParcelInclude;

const PENDING_STATUSES: ParcelStatus[] = [
  ParcelStatus.RECEIVED,
  ParcelStatus.NOTIFIED,
  ParcelStatus.OVERDUE,
];

/** Minimum interval between overdue reminder notifications for the same parcel. */
const OVERDUE_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ParcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateParcelDto): Promise<Parcel> {
    this.assertGuardOrManagement(user, dto.condoId);

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, condoId: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.condoId !== dto.condoId) {
      throw new BadRequestException('Unit does not belong to this condo');
    }

    const parcel = await this.prisma.parcel.create({
      data: {
        condoId: dto.condoId,
        unitId: dto.unitId,
        recipientName: dto.recipientName.trim(),
        carrier: dto.carrier?.trim() || null,
        trackingRef: dto.trackingRef?.trim() || null,
        photoUrl: dto.photoUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
        receivedByGuardId: user.id,
        status: ParcelStatus.NOTIFIED,
      },
      include: parcelInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: dto.condoId,
        unitId: dto.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.CREATE,
        resourceType: 'Parcel',
        resourceId: parcel.id,
      },
    });

    this.events.emit('parcel.received', {
      parcelId: parcel.id,
      condoId: parcel.condoId,
      unitId: parcel.unitId,
    });

    return parcel;
  }

  async listForCondo(user: AuthenticatedUser, condoId: string, query: ListParcelsDto) {
    this.assertGuardOrManagement(user, condoId);
    return this.listWhere({ condoId }, query);
  }

  async listForUnit(user: AuthenticatedUser, unitId: string, query: ListParcelsDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { condoId: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (!this.userCanAccessUnit(user, unitId, unit.condoId)) {
      throw new ForbiddenException('No access to parcels for this unit');
    }
    return this.listWhere({ unitId }, query);
  }

  async get(user: AuthenticatedUser, id: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: parcelInclude,
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (!this.userCanReadParcel(user, parcel)) {
      throw new ForbiddenException('No access to this parcel');
    }
    return parcel;
  }

  async collect(user: AuthenticatedUser, id: string, dto: CollectParcelDto) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.status === ParcelStatus.COLLECTED) {
      throw new BadRequestException('Parcel already collected');
    }
    if (!this.userCanCollectParcel(user, parcel)) {
      throw new ForbiddenException('You cannot mark this parcel as collected');
    }

    const now = new Date();
    const updated = await this.prisma.parcel.update({
      where: { id },
      data: {
        status: ParcelStatus.COLLECTED,
        collectedAt: now,
        collectedByUserId: user.id,
        notes: dto.notes?.trim() ?? parcel.notes,
      },
      include: parcelInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: parcel.condoId,
        unitId: parcel.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'Parcel',
        resourceId: parcel.id,
        metadata: { collected: true } as Prisma.InputJsonValue,
      },
    });

    this.events.emit('parcel.collected', {
      parcelId: parcel.id,
      condoId: parcel.condoId,
      unitId: parcel.unitId,
    });

    return updated;
  }

  /**
   * Flag uncollected parcels past the overdue threshold and emit
   * `parcel.overdue` per parcel (de-duped via `lastOverdueNotifiedAt`).
   */
  async detectOverdue(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - PARCEL_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.parcel.findMany({
      where: {
        status: { in: PENDING_STATUSES },
        receivedAt: { lt: cutoff },
      },
      select: {
        id: true,
        condoId: true,
        unitId: true,
        status: true,
        lastOverdueNotifiedAt: true,
      },
    });

    let flagged = 0;
    for (const p of candidates) {
      const alreadyNotified =
        p.lastOverdueNotifiedAt &&
        now.getTime() - p.lastOverdueNotifiedAt.getTime() < OVERDUE_REMINDER_INTERVAL_MS;
      if (alreadyNotified) continue;

      await this.prisma.parcel.update({
        where: { id: p.id },
        data: {
          status: ParcelStatus.OVERDUE,
          lastOverdueNotifiedAt: now,
        },
      });

      this.events.emit('parcel.overdue', {
        parcelId: p.id,
        condoId: p.condoId,
        unitId: p.unitId,
      });
      flagged++;
    }
    return flagged;
  }

  private async listWhere(scope: { condoId?: string; unitId?: string }, query: ListParcelsDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where: Prisma.ParcelWhereInput = { ...scope };

    if (query.status) where.status = query.status;
    if (query.unitId) where.unitId = query.unitId;
    if (query.pendingOnly) where.status = { in: PENDING_STATUSES };
    if (query.from || query.to) {
      where.receivedAt = {};
      if (query.from) where.receivedAt.gte = query.from;
      if (query.to) where.receivedAt.lte = query.to;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.parcel.findMany({
        where,
        include: parcelInclude,
        orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.parcel.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  private userCanAccessUnit(user: AuthenticatedUser, unitId: string, condoId: string): boolean {
    if (this.isGuardOrManagement(user, condoId)) return true;
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.UNIT_OWNER ||
          r.roleId === RoleId.TENANT ||
          r.roleId === RoleId.HOUSEHOLD_MEMBER) &&
        r.unitId === unitId,
    );
  }

  private userCanReadParcel(
    user: AuthenticatedUser,
    parcel: { condoId: string; unitId: string },
  ): boolean {
    if (this.isGuardOrManagement(user, parcel.condoId)) return true;
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.UNIT_OWNER ||
          r.roleId === RoleId.TENANT ||
          r.roleId === RoleId.HOUSEHOLD_MEMBER) &&
        r.unitId === parcel.unitId,
    );
  }

  private userCanCollectParcel(
    user: AuthenticatedUser,
    parcel: { condoId: string; unitId: string },
  ): boolean {
    if (this.isGuardOrManagement(user, parcel.condoId)) return true;
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.UNIT_OWNER || r.roleId === RoleId.TENANT) &&
        r.unitId === parcel.unitId,
    );
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private isGuardOrManagement(user: AuthenticatedUser, condoId: string): boolean {
    return (
      this.isManagement(user, condoId) ||
      user.roles.some((r) => r.roleId === RoleId.SECURITY_GUARD && r.condoId === condoId)
    );
  }

  private assertGuardOrManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isGuardOrManagement(user, condoId)) {
      throw new ForbiddenException('Guard or management access required for this condo');
    }
  }
}
