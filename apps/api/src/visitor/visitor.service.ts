import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  OwnershipStatus,
  TenancyStatus,
  VisitorStatus,
  VisitorVisitType,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import {
  buildQrPayload,
  generateAccessCode,
  isVisitorId,
  normalizePassInput,
  parseQrPayload,
} from './access-code';
import type {
  CheckInVisitorDto,
  CreateVisitorDto,
  CreateWalkInOfficeDto,
  CreateWalkInUnitDto,
} from './dto/visitor.dto';
import {
  DEFAULT_VISIT_DURATION_MINS,
  PRE_REG_EXPIRY_BUFFER_MINS,
  WALK_IN_APPROVAL_MINUTES,
  WALK_IN_CHECK_IN_WINDOW_MINS,
} from './visitor.constants';

const CHECK_IN_ALLOWED: VisitorStatus[] = [VisitorStatus.APPROVED];

const visitorInclude = {
  unit: { include: { block: true } },
  host: true,
  checkIns: true,
} as const;

@Injectable()
export class VisitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private addMinutes(date: Date, mins: number): Date {
    return new Date(date.getTime() + mins * 60_000);
  }

  private computePreRegExpiresAt(expectedAt: Date, durationMins?: number | null): Date {
    const windowMins = durationMins ?? DEFAULT_VISIT_DURATION_MINS;
    return this.addMinutes(expectedAt, windowMins + PRE_REG_EXPIRY_BUFFER_MINS);
  }

  private async uniqueAccessCode(condoId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const accessCode = generateAccessCode();
      const existing = await this.prisma.visitor.findUnique({
        where: { condoId_accessCode: { condoId, accessCode } },
      });
      if (!existing) return accessCode;
    }
    throw new BadRequestException('Could not allocate access code — try again');
  }

  private passFields(condoId: string, visitorId: string, accessCode: string) {
    const qrPayload = buildQrPayload(condoId, visitorId, accessCode);
    return { accessCode, qrPayload, qrCode: qrPayload };
  }

  private async getUnitResidentIds(unitId: string): Promise<string[]> {
    const [owners, tenants] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { unitId, status: OwnershipStatus.ACTIVE },
        select: { userId: true },
      }),
      this.prisma.tenancy.findMany({
        where: { unitId, status: TenancyStatus.ACTIVE },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...owners.map((o) => o.userId), ...tenants.map((t) => t.userId)])];
  }

  private userCanApproveUnit(user: AuthenticatedUser, unitId: string): boolean {
    return user.roles.some(
      (r) => r.unitId === unitId && (r.roleId === 'UNIT_OWNER' || r.roleId === 'TENANT'),
    );
  }

  private userCanManageUnit(user: AuthenticatedUser, unitId: string): boolean {
    return user.roles.some(
      (r) =>
        r.unitId === unitId &&
        (r.roleId === 'UNIT_OWNER' || r.roleId === 'TENANT' || r.roleId === 'HOUSEHOLD_MEMBER'),
    );
  }

  private guardCondoId(guard: AuthenticatedUser): string {
    const condoId = guard.activeCondoId;
    if (!condoId) throw new BadRequestException('Active condo context required');
    return condoId;
  }

  /** Expire stale passes (lazy, called on read/verify paths). */
  async expireStale(condoId?: string) {
    const now = new Date();
    const scope = condoId ? { condoId } : {};

    await this.prisma.visitor.updateMany({
      where: {
        ...scope,
        status: VisitorStatus.PENDING_OWNER_APPROVAL,
        approvalDeadline: { lt: now },
      },
      data: { status: VisitorStatus.EXPIRED },
    });

    await this.prisma.visitor.updateMany({
      where: {
        ...scope,
        status: VisitorStatus.APPROVED,
        expiresAt: { lt: now },
        visitType: { in: [VisitorVisitType.PRE_REG, VisitorVisitType.WALKIN_UNIT] },
      },
      data: { status: VisitorStatus.EXPIRED },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateVisitorDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const accessCode = await this.uniqueAccessCode(unit.condoId);
    const duration = dto.expectedDurationMins ?? DEFAULT_VISIT_DURATION_MINS;
    const expiresAt = this.computePreRegExpiresAt(dto.expectedAt, duration);

    const visitor = await this.prisma.visitor.create({
      data: {
        condoId: unit.condoId,
        visitType: VisitorVisitType.PRE_REG,
        unitId: unit.id,
        hostUserId: user.id,
        name: dto.name,
        identification: dto.identification,
        phone: dto.phone,
        vehiclePlate: dto.vehiclePlate,
        purpose: dto.purpose,
        expectedAt: dto.expectedAt,
        expectedDurationMins: duration,
        status: VisitorStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
        expiresAt,
        accessCode,
        qrPayload: buildQrPayload(unit.condoId, 'pending', accessCode),
        qrCode: null,
      },
    });

    const pass = this.passFields(unit.condoId, visitor.id, accessCode);
    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: pass,
    });

    this.events.emit('visitor.created', { visitorId: updated.id, condoId: updated.condoId });
    return updated;
  }

  async createWalkInUnit(guard: AuthenticatedUser, dto: CreateWalkInUnitDto) {
    const condoId = this.guardCondoId(guard);
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, condoId },
    });
    if (!unit) throw new NotFoundException('Unit not found in this condo');

    const approvalDeadline = this.addMinutes(new Date(), WALK_IN_APPROVAL_MINUTES);
    const visitor = await this.prisma.visitor.create({
      data: {
        condoId,
        visitType: VisitorVisitType.WALKIN_UNIT,
        unitId: unit.id,
        hostUserId: null,
        name: dto.name,
        phone: dto.phone,
        vehiclePlate: dto.vehiclePlate,
        purpose: dto.purpose,
        expectedAt: new Date(),
        status: VisitorStatus.PENDING_OWNER_APPROVAL,
        approvalDeadline,
        metadata: { createdByGuardId: guard.id },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId: unit.id,
        actorUserId: guard.id,
        actorRole: guard.activeRole,
        action: AuditAction.CREATE,
        resourceType: 'Visitor',
        resourceId: visitor.id,
        metadata: { visitType: 'WALKIN_UNIT', status: 'PENDING_OWNER_APPROVAL' },
      },
    });

    this.events.emit('visitor.walk_in_requested', { visitorId: visitor.id, condoId });
    return visitor;
  }

  async createWalkInOffice(guard: AuthenticatedUser, dto: CreateWalkInOfficeDto) {
    const condoId = this.guardCondoId(guard);
    if (!dto.purpose?.trim()) {
      throw new BadRequestException('Purpose is required for management office visitors');
    }

    const visitor = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          condoId,
          visitType: VisitorVisitType.WALKIN_OFFICE,
          unitId: null,
          hostUserId: null,
          name: dto.name,
          phone: dto.phone,
          vehiclePlate: dto.vehiclePlate,
          purpose: dto.purpose.trim(),
          expectedAt: new Date(),
          status: VisitorStatus.CHECKED_IN,
          metadata: { createdByGuardId: guard.id, routedTo: 'management' },
        },
      });
      const checkIn = await tx.visitorCheckIn.create({
        data: {
          visitorId: v.id,
          checkInGuardId: guard.id,
          gateLocation: dto.gateLocation ?? 'Management office',
          notes: dto.notes ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId,
          unitId: null,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'VisitorCheckIn',
          resourceId: checkIn.id,
          metadata: { visitType: 'WALKIN_OFFICE', purpose: dto.purpose },
        },
      });
      return v;
    });

    this.events.emit('visitor.checked_in', { visitorId: visitor.id, condoId });
    return visitor;
  }

  async approve(visitorId: string, user: AuthenticatedUser) {
    await this.expireStale();
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (visitor.visitType !== VisitorVisitType.WALKIN_UNIT) {
      throw new BadRequestException('Only unit walk-in visitors can be approved');
    }
    if (!visitor.unitId || !this.userCanApproveUnit(user, visitor.unitId)) {
      throw new ForbiddenException('You cannot approve visitors for this unit');
    }
    if (visitor.status !== VisitorStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException(`Visitor is ${visitor.status}, not awaiting approval`);
    }
    if (visitor.approvalDeadline && visitor.approvalDeadline < new Date()) {
      await this.prisma.visitor.update({
        where: { id: visitorId },
        data: { status: VisitorStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Approval window expired — ask the guard to re-register the visitor',
      );
    }

    const expiresAt = this.addMinutes(new Date(), WALK_IN_CHECK_IN_WINDOW_MINS);
    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.update({
        where: { id: visitorId },
        data: {
          status: VisitorStatus.APPROVED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: visitor.condoId,
          unitId: visitor.unitId,
          actorUserId: user.id,
          actorRole: user.activeRole,
          action: AuditAction.UPDATE,
          resourceType: 'Visitor',
          resourceId: visitorId,
          metadata: { decision: 'approved' },
        },
      });
      return v;
    });

    this.events.emit('visitor.approved', { visitorId, condoId: visitor.condoId });
    return updated;
  }

  async reject(visitorId: string, user: AuthenticatedUser, reason?: string) {
    await this.expireStale();
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (visitor.visitType !== VisitorVisitType.WALKIN_UNIT) {
      throw new BadRequestException('Only unit walk-in visitors can be rejected');
    }
    if (!visitor.unitId || !this.userCanApproveUnit(user, visitor.unitId)) {
      throw new ForbiddenException('You cannot reject visitors for this unit');
    }
    if (visitor.status !== VisitorStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException(`Visitor is ${visitor.status}, not awaiting approval`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.update({
        where: { id: visitorId },
        data: { status: VisitorStatus.REJECTED },
      });
      await tx.auditLog.create({
        data: {
          condoId: visitor.condoId,
          unitId: visitor.unitId,
          actorUserId: user.id,
          actorRole: user.activeRole,
          action: AuditAction.UPDATE,
          resourceType: 'Visitor',
          resourceId: visitorId,
          metadata: { decision: 'rejected', reason: reason ?? null },
        },
      });
      return v;
    });

    this.events.emit('visitor.rejected', { visitorId, condoId: visitor.condoId });
    return updated;
  }

  async regenerateAccessCode(visitorId: string, user: AuthenticatedUser) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (visitor.visitType !== VisitorVisitType.PRE_REG) {
      throw new BadRequestException('Only pre-registered passes have access codes');
    }
    if (visitor.hostUserId !== user.id && !this.userCanManageUnit(user, visitor.unitId ?? '')) {
      throw new ForbiddenException('Only the host can regenerate this pass');
    }
    if (visitor.status !== VisitorStatus.APPROVED) {
      throw new BadRequestException('Pass cannot be regenerated after use or cancellation');
    }
    if (visitor.expiresAt && visitor.expiresAt < new Date()) {
      throw new BadRequestException('Pass has expired');
    }

    const accessCode = await this.uniqueAccessCode(visitor.condoId);
    const pass = this.passFields(visitor.condoId, visitor.id, accessCode);
    return this.prisma.visitor.update({ where: { id: visitorId }, data: pass });
  }

  async getQrPng(visitorId: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    const payload = visitor.qrPayload ?? visitor.qrCode;
    if (!payload) throw new BadRequestException('This visitor pass has no QR code');
    const png = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', width: 512 });
    return {
      qrPayload: payload,
      accessCode: visitor.accessCode,
      png,
    };
  }

  async listForUnit(unitId: string, opts: { limit: number; offset: number }) {
    await this.expireStale();
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where: { unitId },
        orderBy: { expectedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        include: visitorInclude,
      }),
      this.prisma.visitor.count({ where: { unitId } }),
    ]);
    return { items, total, ...opts };
  }

  async listForCondo(
    condoId: string,
    opts: { limit: number; offset: number; status?: VisitorStatus },
  ) {
    await this.expireStale(condoId);
    const where = { condoId, ...(opts.status ? { status: opts.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        orderBy: { expectedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        include: visitorInclude,
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async cancel(visitorId: string, user: AuthenticatedUser) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (visitor.hostUserId !== user.id) {
      throw new BadRequestException('Only the host can cancel this visitor');
    }
    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { status: VisitorStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  /** Resolve a visitor pass by QR payload, access code, or visitor id. */
  async verifyByPass(pass: string, condoId?: string) {
    await this.expireStale(condoId);
    const normalized = normalizePassInput(pass);

    if (isVisitorId(normalized)) {
      const byId = await this.prisma.visitor.findUnique({
        where: { id: normalized },
        include: visitorInclude,
      });
      if (byId) return this.enrichVerifyResult(byId);
    }

    const parsed = parseQrPayload(normalized);
    if (parsed) {
      const byPayload = await this.prisma.visitor.findFirst({
        where: { id: parsed.visitorId, condoId: parsed.condoId },
        include: visitorInclude,
      });
      if (byPayload) return this.enrichVerifyResult(byPayload);
    }

    const lookups = await Promise.all([
      this.prisma.visitor.findUnique({
        where: { qrPayload: normalized },
        include: visitorInclude,
      }),
      this.prisma.visitor.findUnique({
        where: { qrCode: normalized },
        include: visitorInclude,
      }),
      condoId
        ? this.prisma.visitor.findUnique({
            where: { condoId_accessCode: { condoId, accessCode: normalized } },
            include: visitorInclude,
          })
        : this.prisma.visitor.findFirst({
            where: { accessCode: normalized },
            include: visitorInclude,
          }),
    ]);

    for (const v of lookups) {
      if (v) return this.enrichVerifyResult(v);
    }

    throw new NotFoundException('Unknown pass — check the QR or access code');
  }

  private enrichVerifyResult(visitor: Awaited<ReturnType<typeof this.verifyByPass>>) {
    if (visitor.status === VisitorStatus.EXPIRED) {
      throw new BadRequestException(
        visitor.visitType === VisitorVisitType.WALKIN_UNIT
          ? 'Owner did not respond in time — contact the resident or ask the visitor to leave'
          : 'Visitor pass has expired',
      );
    }
    return visitor;
  }

  async checkIn(pass: string, guard: AuthenticatedUser, dto: CheckInVisitorDto) {
    const condoId = this.guardCondoId(guard);
    const visitor = await this.verifyByPass(pass, condoId);
    if (visitor.condoId !== condoId) {
      throw new ForbiddenException('Visitor pass is not for this condo');
    }
    if (visitor.status === VisitorStatus.CHECKED_IN) {
      throw new BadRequestException('Visitor already checked in');
    }
    if (!CHECK_IN_ALLOWED.includes(visitor.status)) {
      throw new BadRequestException(`Cannot check in visitor with status ${visitor.status}`);
    }
    if (visitor.expiresAt && visitor.expiresAt < new Date()) {
      await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: { status: VisitorStatus.EXPIRED },
      });
      throw new BadRequestException('Visitor pass has expired');
    }

    const update = await this.prisma.$transaction(async (tx) => {
      await tx.visitor.update({
        where: { id: visitor.id },
        data: { status: VisitorStatus.CHECKED_IN },
      });
      const checkIn = await tx.visitorCheckIn.create({
        data: {
          visitorId: visitor.id,
          checkInGuardId: guard.id,
          gateLocation: dto.gateLocation ?? null,
          notes: dto.notes ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: visitor.condoId,
          unitId: visitor.unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'VisitorCheckIn',
          resourceId: checkIn.id,
        },
      });
      return checkIn;
    });
    this.events.emit('visitor.checked_in', { visitorId: visitor.id, condoId: visitor.condoId });
    return update;
  }

  async checkOut(pass: string, guard: AuthenticatedUser) {
    const condoId = this.guardCondoId(guard);
    const visitor = await this.verifyByPass(pass, condoId);
    const lastCheckIn = await this.prisma.visitorCheckIn.findFirst({
      where: { visitorId: visitor.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!lastCheckIn) throw new BadRequestException('No active check-in for this visitor');

    const updated = await this.prisma.visitorCheckIn.update({
      where: { id: lastCheckIn.id },
      data: { checkOutAt: new Date(), checkOutGuardId: guard.id },
    });
    await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { status: VisitorStatus.CHECKED_OUT },
    });
    this.events.emit('visitor.checked_out', { visitorId: visitor.id, condoId: visitor.condoId });
    return updated;
  }
}
