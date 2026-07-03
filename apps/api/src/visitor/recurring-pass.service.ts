import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, type Prisma, RoleId, VisitorStatus, VisitorVisitType } from '@prisma/client';
import { isValidMalaysiaPhone, normalizeMalaysiaPhone } from '@smartresidence/shared-types';
import { formatUnitLabel } from '@smartresidence/shared-types';
import {
  buildQrPayload,
  generateAccessCode,
  isVisitorId,
  normalizePassInput,
  parseQrPayload,
} from './access-code';
import type { CreateRecurringPassDto, UpdateRecurringPassDto } from './dto/recurring-pass.dto';
import type { CheckInVisitorDto } from './dto/visitor.dto';
import { isWithinRecurringSchedule, parseRecurringPassSchedule } from './recurring-pass-schedule';
import { VisitorBlacklistService } from './visitor-blacklist.service';

const passInclude = {
  unit: { include: { block: true } },
  host: { select: { id: true, name: true } },
} as const;

function normalizePlate(plate?: string | null): string | null {
  const trimmed = plate?.trim().toUpperCase().replace(/[\s-]/g, '');
  return trimmed || null;
}

@Injectable()
export class RecurringPassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blacklist: VisitorBlacklistService,
    private readonly events: EventEmitter2,
  ) {}

  async listForUnit(user: AuthenticatedUser, unitId: string) {
    if (!this.userCanManageUnit(user, unitId)) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { condoId: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');
      if (!this.userIsManagement(user, unit.condoId)) {
        throw new ForbiddenException('You cannot access recurring passes for this unit');
      }
    }
    const items = await this.prisma.recurringPass.findMany({
      where: { unitId },
      orderBy: [{ active: 'desc' }, { validFrom: 'desc' }],
      include: passInclude,
    });
    return { items, total: items.length };
  }

  async listForCondo(user: AuthenticatedUser, condoId: string) {
    if (!this.userIsManagement(user, condoId)) {
      throw new ForbiddenException('You cannot access recurring passes for this condo');
    }
    const items = await this.prisma.recurringPass.findMany({
      where: { condoId },
      orderBy: [{ active: 'desc' }, { validFrom: 'desc' }],
      include: passInclude,
    });
    return { items, total: items.length };
  }

  async create(user: AuthenticatedUser, dto: CreateRecurringPassDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { condo: true, block: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (!this.userCanManageUnit(user, unit.id)) {
      throw new ForbiddenException('You can only create recurring passes for your unit');
    }

    const guestPhone = dto.guestPhone ? this.normalizePhone(dto.guestPhone) : null;
    const accessCode = await this.uniqueAccessCode(unit.condoId);

    const pass = await this.prisma.recurringPass.create({
      data: {
        condoId: unit.condoId,
        unitId: unit.id,
        hostUserId: user.id,
        guestName: dto.guestName.trim(),
        guestPhone,
        vehiclePlate: normalizePlate(dto.vehiclePlate),
        schedule: dto.schedule as unknown as Prisma.InputJsonValue,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        accessCode,
        qrPayload: buildQrPayload(unit.condoId, 'pending', accessCode),
      },
      include: passInclude,
    });

    const qrPayload = buildQrPayload(unit.condoId, pass.id, accessCode);
    const updated = await this.prisma.recurringPass.update({
      where: { id: pass.id },
      data: { qrPayload, qrCode: qrPayload },
      include: passInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: unit.condoId,
        unitId: unit.id,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.CREATE,
        resourceType: 'RecurringPass',
        resourceId: pass.id,
      },
    });

    return updated;
  }

  async update(passId: string, user: AuthenticatedUser, dto: UpdateRecurringPassDto) {
    const existing = await this.prisma.recurringPass.findUnique({
      where: { id: passId },
      include: passInclude,
    });
    if (!existing) throw new NotFoundException('Recurring pass not found');
    if (!this.userCanManageUnit(user, existing.unitId)) {
      throw new ForbiddenException('You can only update recurring passes for your unit');
    }

    const data: Record<string, unknown> = {};
    if (dto.guestName !== undefined) data.guestName = dto.guestName.trim();
    if (dto.guestPhone !== undefined) {
      data.guestPhone = dto.guestPhone ? this.normalizePhone(dto.guestPhone) : null;
    }
    if (dto.vehiclePlate !== undefined) data.vehiclePlate = normalizePlate(dto.vehiclePlate);
    if (dto.schedule !== undefined)
      data.schedule = dto.schedule as unknown as Prisma.InputJsonValue;
    if (dto.validFrom !== undefined) data.validFrom = dto.validFrom;
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil;
    if (dto.active !== undefined) data.active = dto.active;

    const validFrom = (data.validFrom as Date | undefined) ?? existing.validFrom;
    const validUntil = (data.validUntil as Date | undefined) ?? existing.validUntil;
    if (validUntil <= validFrom) {
      throw new BadRequestException('Valid until must be after valid from');
    }

    const updated = await this.prisma.recurringPass.update({
      where: { id: passId },
      data,
      include: passInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: existing.condoId,
        unitId: existing.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'RecurringPass',
        resourceId: passId,
      },
    });

    return updated;
  }

  async remove(passId: string, user: AuthenticatedUser) {
    const existing = await this.prisma.recurringPass.findUnique({ where: { id: passId } });
    if (!existing) throw new NotFoundException('Recurring pass not found');
    if (!this.userCanManageUnit(user, existing.unitId)) {
      throw new ForbiddenException('You can only delete recurring passes for your unit');
    }

    await this.prisma.recurringPass.delete({ where: { id: passId } });

    await this.prisma.auditLog.create({
      data: {
        condoId: existing.condoId,
        unitId: existing.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.DELETE,
        resourceType: 'RecurringPass',
        resourceId: passId,
      },
    });
  }

  async verifyByPass(pass: string, condoId?: string) {
    const row = await this.resolvePass(pass, condoId);
    if (!row.active) throw new BadRequestException('Recurring pass is inactive');

    const now = new Date();
    if (row.validFrom > now) {
      throw new BadRequestException(
        `Recurring pass not yet active — valid from ${row.validFrom.toLocaleString()}`,
      );
    }
    if (row.validUntil < now) {
      throw new BadRequestException('Recurring pass has expired');
    }

    const condo = await this.prisma.condo.findUnique({ where: { id: row.condoId } });
    const schedule = parseRecurringPassSchedule(row.schedule);
    const scheduleCheck = isWithinRecurringSchedule(
      schedule,
      now,
      condo?.timezone ?? 'Asia/Kuala_Lumpur',
    );

    return {
      passType: 'recurring' as const,
      id: row.id,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      vehiclePlate: row.vehiclePlate,
      accessCode: row.accessCode,
      unitLabel: row.unit ? formatUnitLabel(row.unit) : null,
      schedule,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      withinSchedule: scheduleCheck.ok,
      scheduleMessage: scheduleCheck.message,
    };
  }

  async checkIn(pass: string, guard: AuthenticatedUser, dto: CheckInVisitorDto) {
    const condoId = guard.activeCondoId;
    if (!condoId) throw new BadRequestException('Active condo context required');

    const row = await this.resolvePass(pass, condoId);
    if (row.condoId !== condoId) {
      throw new ForbiddenException('Recurring pass is not for this condo');
    }
    if (!row.active) throw new BadRequestException('Recurring pass is inactive');

    const now = new Date();
    if (row.validFrom > now || row.validUntil < now) {
      throw new BadRequestException('Recurring pass is outside its validity period');
    }

    const condo = await this.prisma.condo.findUnique({ where: { id: row.condoId } });
    const schedule = parseRecurringPassSchedule(row.schedule);
    const scheduleCheck = isWithinRecurringSchedule(
      schedule,
      now,
      condo?.timezone ?? 'Asia/Kuala_Lumpur',
    );
    if (!scheduleCheck.ok) {
      throw new BadRequestException(scheduleCheck.message ?? 'Outside recurring pass schedule');
    }

    await this.blacklist.assertNotBlacklisted(row.condoId, {
      name: row.guestName,
      phone: row.guestPhone,
      vehiclePlate: row.vehiclePlate,
    });

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const visitor = await tx.visitor.create({
        data: {
          condoId: row.condoId,
          visitType: VisitorVisitType.PRE_REG,
          unitId: row.unitId,
          hostUserId: row.hostUserId,
          name: row.guestName,
          phone: row.guestPhone,
          phoneCountryCode: '+60',
          vehiclePlate: row.vehiclePlate,
          expectedAt: now,
          status: VisitorStatus.CHECKED_IN,
          approvedByUserId: row.hostUserId,
          approvedAt: now,
          metadata: { recurringPassId: row.id, checkInSource: 'RECURRING_PASS' },
        },
      });

      const record = await tx.visitorCheckIn.create({
        data: {
          visitorId: visitor.id,
          checkInGuardId: guard.id,
          gateLocation: dto.gateLocation ?? null,
          notes: dto.notes ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          condoId: row.condoId,
          unitId: row.unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'VisitorCheckIn',
          resourceId: record.id,
          metadata: { recurringPassId: row.id },
        },
      });

      return record;
    });

    this.events.emit('visitor.checked_in', { visitorId: checkIn.visitorId, condoId: row.condoId });
    return checkIn;
  }

  private async resolvePass(pass: string, condoId?: string) {
    const normalized = normalizePassInput(pass);

    if (isVisitorId(normalized)) {
      const byId = await this.prisma.recurringPass.findUnique({
        where: { id: normalized },
        include: passInclude,
      });
      if (byId) return byId;
    }

    const parsed = parseQrPayload(normalized);
    if (parsed) {
      const byPayload = await this.prisma.recurringPass.findFirst({
        where: { id: parsed.visitorId, condoId: parsed.condoId },
        include: passInclude,
      });
      if (byPayload) return byPayload;
    }

    const lookups = await Promise.all([
      this.prisma.recurringPass.findUnique({
        where: { qrPayload: normalized },
        include: passInclude,
      }),
      condoId
        ? this.prisma.recurringPass.findUnique({
            where: { condoId_accessCode: { condoId, accessCode: normalized } },
            include: passInclude,
          })
        : this.prisma.recurringPass.findFirst({
            where: { accessCode: normalized },
            include: passInclude,
          }),
    ]);

    for (const row of lookups) {
      if (row) return row;
    }

    throw new NotFoundException('Unknown recurring pass — check the QR or access code');
  }

  private async uniqueAccessCode(condoId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const accessCode = generateAccessCode();
      const [visitor, recurring] = await Promise.all([
        this.prisma.visitor.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
        }),
        this.prisma.recurringPass.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
        }),
      ]);
      if (!visitor && !recurring) return accessCode;
    }
    throw new BadRequestException('Could not allocate access code — try again');
  }

  private userCanManageUnit(user: AuthenticatedUser, unitId: string): boolean {
    return user.roles.some(
      (r) => r.unitId === unitId && (r.roleId === RoleId.UNIT_OWNER || r.roleId === RoleId.TENANT),
    );
  }

  private userIsManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private normalizePhone(phone: string): string {
    const normalized = normalizeMalaysiaPhone(phone);
    if (!isValidMalaysiaPhone(normalized)) {
      throw new BadRequestException('Enter a valid Malaysia mobile number');
    }
    return normalized;
  }
}
