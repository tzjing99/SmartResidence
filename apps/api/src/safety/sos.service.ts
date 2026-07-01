import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RoleId, type SosAlert, SosStatus } from '@prisma/client';
import type { RaiseSosDto, ResolveSosDto } from './dto/sos.dto';

const sosInclude = {
  raisedBy: { select: { id: true, name: true } },
  acknowledgedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  unit: { select: { id: true, identifier: true } },
} satisfies Prisma.SosAlertInclude;

const OPEN_STATUSES: SosStatus[] = [SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED];

@Injectable()
export class SosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Any authenticated member of the condo raises an SOS alert (ACTIVE). */
  async raise(actor: AuthenticatedUser, dto: RaiseSosDto) {
    this.assertCondoMember(actor, dto.condoId);
    if (dto.unitId) await this.assertActsForUnit(actor, dto.unitId, dto.condoId);

    const alert = await this.prisma.sosAlert.create({
      data: {
        condoId: dto.condoId,
        raisedByUserId: actor.id,
        unitId: dto.unitId ?? null,
        kind: dto.kind ?? undefined,
        locationNote: dto.locationNote?.trim() || null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
      },
      include: sosInclude,
    });

    this.events.emit('sos.raised', {
      condoId: alert.condoId,
      sosId: alert.id,
      raisedByUserId: alert.raisedByUserId,
    });
    return alert;
  }

  /** Management + guards: currently open alerts plus recently closed ones. */
  async listForCondo(actor: AuthenticatedUser, condoId: string) {
    this.assertManagementOrGuard(actor, condoId);
    const [active, recent] = await this.prisma.$transaction([
      this.prisma.sosAlert.findMany({
        where: { condoId, status: { in: OPEN_STATUSES } },
        include: sosInclude,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sosAlert.findMany({
        where: { condoId, status: { in: [SosStatus.RESOLVED, SosStatus.CANCELLED] } },
        include: sosInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { active, recent };
  }

  /** Alerts raised by the current user (resident sees their own status). */
  async listMine(actor: AuthenticatedUser, opts: { limit: number; offset: number }) {
    const where: Prisma.SosAlertWhereInput = { raisedByUserId: actor.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sosAlert.findMany({
        where,
        include: sosInclude,
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.sosAlert.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async get(actor: AuthenticatedUser, id: string): Promise<SosAlert> {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id }, include: sosInclude });
    if (!alert) throw new NotFoundException('SOS alert not found');
    const isRaiser = alert.raisedByUserId === actor.id;
    if (!isRaiser && !this.isManagementOrGuard(actor, alert.condoId)) {
      throw new ForbiddenException('You cannot view this alert');
    }
    return alert;
  }

  async acknowledge(actor: AuthenticatedUser, id: string) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('SOS alert not found');
    this.assertManagementOrGuard(actor, alert.condoId);
    if (alert.status !== SosStatus.ACTIVE) {
      throw new BadRequestException('Only active alerts can be acknowledged');
    }
    const updated = await this.prisma.sosAlert.update({
      where: { id },
      data: {
        status: SosStatus.ACKNOWLEDGED,
        acknowledgedByUserId: actor.id,
        acknowledgedAt: new Date(),
      },
      include: sosInclude,
    });
    this.events.emit('sos.acknowledged', {
      condoId: updated.condoId,
      sosId: updated.id,
      raisedByUserId: updated.raisedByUserId,
      actorUserId: actor.id,
    });
    return updated;
  }

  async resolve(actor: AuthenticatedUser, id: string, dto: ResolveSosDto) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('SOS alert not found');
    this.assertManagementOrGuard(actor, alert.condoId);
    if (!OPEN_STATUSES.includes(alert.status)) {
      throw new BadRequestException('This alert is already closed');
    }
    const updated = await this.prisma.sosAlert.update({
      where: { id },
      data: {
        status: SosStatus.RESOLVED,
        resolvedByUserId: actor.id,
        resolvedAt: new Date(),
        resolutionNote: dto.resolutionNote?.trim() || null,
      },
      include: sosInclude,
    });
    this.events.emit('sos.resolved', {
      condoId: updated.condoId,
      sosId: updated.id,
      raisedByUserId: updated.raisedByUserId,
      actorUserId: actor.id,
    });
    return updated;
  }

  /** The raiser (or management) cancels an open alert (false alarm). */
  async cancel(actor: AuthenticatedUser, id: string) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('SOS alert not found');
    const isRaiser = alert.raisedByUserId === actor.id;
    if (!isRaiser && !this.isManagementOrGuard(actor, alert.condoId)) {
      throw new ForbiddenException('You cannot cancel this alert');
    }
    if (!OPEN_STATUSES.includes(alert.status)) {
      throw new BadRequestException('This alert is already closed');
    }
    const updated = await this.prisma.sosAlert.update({
      where: { id },
      data: { status: SosStatus.CANCELLED, cancelledAt: new Date() },
      include: sosInclude,
    });
    this.events.emit('sos.cancelled', {
      condoId: updated.condoId,
      sosId: updated.id,
      raisedByUserId: updated.raisedByUserId,
      actorUserId: actor.id,
      byManagement: !isRaiser,
    });
    return updated;
  }

  // -- access helpers -------------------------------------------------

  private isManagementOrGuard(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN ||
          r.roleId === RoleId.MANAGEMENT_STAFF ||
          r.roleId === RoleId.SECURITY_GUARD) &&
          r.condoId === condoId),
    );
  }

  private assertManagementOrGuard(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagementOrGuard(user, condoId)) {
      throw new ForbiddenException('Management or guard access required for this condo');
    }
  }

  private assertCondoMember(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }

  private async assertActsForUnit(actor: AuthenticatedUser, unitId: string, condoId: string) {
    if (this.isManagementOrGuard(actor, condoId)) return;
    if (actor.roles.some((r) => r.unitId === unitId)) return;
    const [ownership, tenancy] = await Promise.all([
      this.prisma.ownership.findFirst({ where: { userId: actor.id, unitId, status: 'ACTIVE' } }),
      this.prisma.tenancy.findFirst({ where: { userId: actor.id, unitId, status: 'ACTIVE' } }),
    ]);
    if (!ownership && !tenancy) {
      throw new ForbiddenException('You are not a resident of the selected unit');
    }
  }
}
