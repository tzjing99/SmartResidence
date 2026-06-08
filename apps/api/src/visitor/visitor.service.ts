import type { AuthenticatedUser } from '@/common/types/request-context';
import { NotificationService } from '@/notification/notification.service';
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
  NotificationKind,
  OwnershipStatus,
  type Prisma,
  RoleId,
  TenancyStatus,
  VisitorEntryMode,
  VisitorPurpose,
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
  CreateFavouriteVisitorDto,
  CreateVisitorDto,
  CreateWalkInOfficeDto,
  CreateWalkInUnitDto,
  FlagPlateMismatchDto,
  SuspendOvernightDto,
  UpdateFavouriteVisitorDto,
  UpdateVisitorSettingsDto,
} from './dto/visitor.dto';
import {
  INDEFINITE_SUSPEND_UNTIL,
  checkUnitOvernightEligibility,
  countMonthlyOvernightForUnit,
  getPrimaryUnitOwner,
  getUnitSuspendPolicy,
  isIndefiniteSuspend,
  isOvernightSuspended,
  parseMonthParam,
} from './overnight-policy';
import {
  buildOvernightHelperMessage,
  hoursUntilArrival,
  nightRangeForArrival,
  resolveOvernightOutcome,
} from './overnight-rules';
import {
  type CondoVisitorSettings,
  mergeVisitorSettings,
  parseCondoVisitorSettings,
  preRegExpiryBufferMins,
  urgentOvernightMinHours,
  walkInApprovalMinutes,
} from './visitor-settings';
import {
  DEFAULT_VISIT_DURATION_MINS,
  type VisitorAdminFilter,
  type VisitorListView,
  WALK_IN_CHECK_IN_WINDOW_MINS,
  statusesForView,
} from './visitor.constants';

const CHECK_IN_ALLOWED: VisitorStatus[] = [VisitorStatus.APPROVED];

const visitorInclude = {
  unit: { include: { block: true } },
  host: true,
  checkIns: true,
} as const;

type VisitorWithRelations = Prisma.VisitorGetPayload<{ include: typeof visitorInclude }>;

@Injectable()
export class VisitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationService,
  ) {}

  private addMinutes(date: Date, mins: number): Date {
    return new Date(date.getTime() + mins * 60_000);
  }

  private rejectWalkInOvernight(overnight?: boolean): void {
    if (overnight) {
      throw new BadRequestException(
        'Overnight stays are only available for pre-registered visitors — walk-ins are one visit validated at the gate',
      );
    }
  }

  private computePreRegExpiresAt(
    expectedAt: Date,
    durationMins: number | null | undefined,
    settings: CondoVisitorSettings,
  ): Date {
    const windowMins = durationMins ?? DEFAULT_VISIT_DURATION_MINS;
    return this.addMinutes(expectedAt, windowMins + preRegExpiryBufferMins(settings));
  }

  private async unitResidentUserIds(unitId: string): Promise<string[]> {
    const [ownerships, tenancies] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { unitId, status: OwnershipStatus.ACTIVE },
        select: { userId: true },
      }),
      this.prisma.tenancy.findMany({
        where: { unitId, status: TenancyStatus.ACTIVE },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...ownerships.map((o) => o.userId), ...tenancies.map((t) => t.userId)])];
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

  private async countOvernightSlots(condoId: string, expectedAt: Date): Promise<number> {
    const { start, end } = nightRangeForArrival(expectedAt);
    return this.prisma.visitor.count({
      where: {
        condoId,
        overnight: true,
        status: {
          in: [
            VisitorStatus.APPROVED,
            VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
            VisitorStatus.CHECKED_IN,
          ],
        },
        expectedAt: { gte: start, lt: end },
      },
    });
  }

  private userIsManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
        r.condoId === condoId,
    );
  }

  private mapWalkInPurpose(purpose?: string): VisitorPurpose {
    if (!purpose?.trim()) return VisitorPurpose.VISITOR;
    const normalized = purpose
      .trim()
      .toUpperCase()
      .replace(/[\s/]+/g, '_');
    const values = Object.values(VisitorPurpose) as string[];
    if (values.includes(normalized)) return normalized as VisitorPurpose;
    return VisitorPurpose.OTHER;
  }

  private async validatePreRegDto(
    dto: CreateVisitorDto,
    unit: { id: string; condoId: string; condo: { settings: unknown } },
  ) {
    const overnight = dto.overnight ?? false;
    const entryMode = overnight
      ? VisitorEntryMode.DRIVE_IN
      : (dto.entryMode ?? VisitorEntryMode.DRIVE_IN);

    if (!dto.phone?.trim()) {
      throw new BadRequestException('Phone number is required for visitors');
    }

    if (entryMode === VisitorEntryMode.DRIVE_IN && !dto.vehiclePlate?.trim()) {
      throw new BadRequestException('Plate number is required for drive-in visitors');
    }
    const settings = parseCondoVisitorSettings(unit.condo.settings);
    if (overnight) {
      if (!dto.vehiclePlate?.trim()) {
        throw new BadRequestException(
          'Overnight visits require a typed plate number that matches your photo',
        );
      }
      if (settings.requirePlatePhotoOvernight && !dto.vehiclePlatePhotoUrl?.trim()) {
        throw new BadRequestException(
          'Overnight visits require a vehicle plate photo — capture the plate on mobile or upload a photo that matches the typed plate',
        );
      }
      const eligibility = await checkUnitOvernightEligibility(
        this.prisma,
        unit.id,
        unit.condoId,
        settings,
      );
      if (!eligibility.allowed) {
        throw new BadRequestException(eligibility.reason ?? 'Overnight registration not allowed');
      }
      const hours = hoursUntilArrival(new Date(), dto.expectedAt);
      if (hours < urgentOvernightMinHours(settings) && !dto.urgentReason?.trim()) {
        throw new BadRequestException(
          'Urgent overnight visits require a brief reason — visit management office before arrival',
        );
      }
    }
  }

  async overnightPreview(condoId: string, expectedAt: Date) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const occupied = await this.countOvernightSlots(condoId, expectedAt);
    return buildOvernightHelperMessage(new Date(), expectedAt, condo.settings, occupied);
  }

  async create(user: AuthenticatedUser, dto: CreateVisitorDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { condo: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    await this.validatePreRegDto(dto, unit);

    const overnight = dto.overnight ?? false;
    const entryMode = overnight
      ? VisitorEntryMode.DRIVE_IN
      : (dto.entryMode ?? VisitorEntryMode.DRIVE_IN);
    const now = new Date();
    let duration = dto.expectedDurationMins ?? DEFAULT_VISIT_DURATION_MINS;
    let status: VisitorStatus = VisitorStatus.APPROVED;
    let urgentOvernight = false;
    let pendingManagementReview = false;
    let approvedByUserId: string | null = user.id;
    let approvedAt: Date | null = now;
    let accessCode: string | null = null;
    let expiresAt: Date | null = null;

    if (overnight) {
      const occupied = await this.countOvernightSlots(unit.condoId, dto.expectedAt);
      try {
        const outcome = resolveOvernightOutcome(now, dto.expectedAt, unit.condo.settings, occupied);
        status = outcome.status as VisitorStatus;
        urgentOvernight = outcome.urgentOvernight;
        pendingManagementReview = outcome.pendingManagementReview;
        duration = outcome.expectedDurationMins;
        if (status === VisitorStatus.PENDING_MANAGEMENT_APPROVAL) {
          approvedByUserId = null;
          approvedAt = null;
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'OVERNIGHT_SLOTS_FULL') {
          throw new BadRequestException(
            'No overnight slots left tonight — contact management or register as urgent and visit the management office',
          );
        }
        throw err;
      }
    }

    const visitorSettings = parseCondoVisitorSettings(unit.condo.settings);

    if (status === VisitorStatus.APPROVED) {
      accessCode = await this.uniqueAccessCode(unit.condoId);
      expiresAt = this.computePreRegExpiresAt(dto.expectedAt, duration, visitorSettings);
    }

    const visitor = await this.prisma.visitor.create({
      data: {
        condoId: unit.condoId,
        visitType: VisitorVisitType.PRE_REG,
        unitId: unit.id,
        hostUserId: user.id,
        name: dto.name,
        identification: dto.identification,
        phone: dto.phone.trim(),
        phoneCountryCode: dto.phoneCountryCode ?? '+60',
        entryMode,
        vehiclePlate: entryMode === VisitorEntryMode.DRIVE_IN ? dto.vehiclePlate?.trim() : null,
        vehiclePlatePhotoUrl: overnight ? dto.vehiclePlatePhotoUrl?.trim() : null,
        purpose: dto.purpose ?? visitorSettings.defaultPurpose,
        overnight,
        urgentOvernight,
        urgentReason: urgentOvernight ? dto.urgentReason?.trim() : null,
        pendingManagementReview,
        expectedAt: dto.expectedAt,
        expectedDurationMins: duration,
        status,
        approvedByUserId,
        approvedAt,
        expiresAt,
        accessCode,
        qrPayload: accessCode ? buildQrPayload(unit.condoId, 'pending', accessCode) : null,
        qrCode: null,
      },
    });

    let updated = visitor;
    if (accessCode) {
      const pass = this.passFields(unit.condoId, visitor.id, accessCode);
      updated = await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: pass,
      });
    }

    this.events.emit('visitor.created', { visitorId: updated.id, condoId: updated.condoId });
    return updated;
  }

  async approveOvernight(visitorId: string, user: AuthenticatedUser) {
    await this.expireStale();
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (!this.userIsManagement(user, visitor.condoId)) {
      throw new ForbiddenException('Only management can approve overnight visitors');
    }
    if (visitor.visitType !== VisitorVisitType.PRE_REG || !visitor.overnight) {
      throw new BadRequestException('Only overnight pre-registrations can be approved here');
    }
    if (visitor.status !== VisitorStatus.PENDING_MANAGEMENT_APPROVAL) {
      throw new BadRequestException(
        `Visitor is ${visitor.status}, not awaiting management approval`,
      );
    }

    const condo = await this.prisma.condo.findUnique({ where: { id: visitor.condoId } });
    const visitorSettings = parseCondoVisitorSettings(condo?.settings);
    const accessCode = await this.uniqueAccessCode(visitor.condoId);
    const duration = visitor.expectedDurationMins ?? DEFAULT_VISIT_DURATION_MINS;
    const expiresAt = this.computePreRegExpiresAt(visitor.expectedAt, duration, visitorSettings);
    const pass = this.passFields(visitor.condoId, visitor.id, accessCode);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.update({
        where: { id: visitorId },
        data: {
          status: VisitorStatus.APPROVED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          expiresAt,
          ...pass,
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
          metadata: { decision: 'overnight_approved' },
        },
      });
      return v;
    });

    this.events.emit('visitor.approved', { visitorId, condoId: visitor.condoId });
    return updated;
  }

  async createWalkInUnit(guard: AuthenticatedUser, dto: CreateWalkInUnitDto) {
    this.rejectWalkInOvernight(dto.overnight);
    const condoId = this.guardCondoId(guard);
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, condoId },
      include: { condo: true },
    });
    if (!unit) throw new NotFoundException('Unit not found in this condo');

    const settings = parseCondoVisitorSettings(unit.condo.settings);
    const approvalDeadline = this.addMinutes(new Date(), walkInApprovalMinutes(settings));
    const visitor = await this.prisma.visitor.create({
      data: {
        condoId,
        visitType: VisitorVisitType.WALKIN_UNIT,
        unitId: unit.id,
        hostUserId: null,
        name: dto.name,
        phone: dto.phone,
        vehiclePlate: dto.vehiclePlate,
        purpose: this.mapWalkInPurpose(dto.purpose),
        overnight: false,
        expectedAt: new Date(),
        status: VisitorStatus.PENDING_OWNER_APPROVAL,
        approvalDeadline,
        metadata: { createdByGuardId: guard.id, singleVisit: true },
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
        metadata: { visitType: 'WALKIN_UNIT', status: 'PENDING_OWNER_APPROVAL', overnight: false },
      },
    });

    this.events.emit('visitor.walk_in_requested', { visitorId: visitor.id, condoId });
    return visitor;
  }

  async createWalkInOffice(guard: AuthenticatedUser, dto: CreateWalkInOfficeDto) {
    this.rejectWalkInOvernight(dto.overnight);
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
          purpose: this.mapWalkInPurpose(dto.purpose),
          overnight: false,
          expectedAt: new Date(),
          status: VisitorStatus.CHECKED_IN,
          metadata: {
            createdByGuardId: guard.id,
            routedTo: 'management',
            purposeNote: dto.purpose.trim(),
            singleVisit: true,
          },
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

  async listForUnit(
    unitId: string,
    opts: { limit: number; offset: number; view?: VisitorListView; status?: VisitorStatus },
  ) {
    await this.expireStale();
    const viewStatuses = statusesForView(opts.view);
    const statusFilter = opts.status
      ? { status: opts.status }
      : viewStatuses
        ? { status: { in: viewStatuses } }
        : {};
    const where = { unitId, ...statusFilter };
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
    return { items, total, ...opts };
  }

  async listForCondo(
    condoId: string,
    opts: {
      limit: number;
      offset: number;
      status?: VisitorStatus;
      view?: VisitorListView;
      filter?: VisitorAdminFilter;
    },
  ) {
    await this.expireStale(condoId);
    const viewStatuses = statusesForView(opts.view);
    const statusFilter = opts.status
      ? { status: opts.status }
      : viewStatuses
        ? { status: { in: viewStatuses } }
        : {};
    const adminFilter = (() => {
      switch (opts.filter) {
        case 'overnight_pending':
          return {
            overnight: true,
            status: VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
          };
        case 'urgent_overnight':
          return { overnight: true, urgentOvernight: true };
        case 'holiday_review':
          return { overnight: true, pendingManagementReview: true };
        default:
          return {};
      }
    })();
    const where = { condoId, ...statusFilter, ...adminFilter };
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
  async verifyByPass(pass: string, condoId?: string): Promise<VisitorWithRelations> {
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

  private enrichVerifyResult(visitor: VisitorWithRelations): VisitorWithRelations {
    if (visitor.status === VisitorStatus.EXPIRED) {
      throw new BadRequestException(
        visitor.visitType === VisitorVisitType.WALKIN_UNIT
          ? 'Owner did not respond in time — contact the resident or ask the visitor to leave'
          : 'Visitor pass has expired',
      );
    }
    if (
      visitor.overnight &&
      visitor.visitType === VisitorVisitType.PRE_REG &&
      visitor.status === VisitorStatus.APPROVED &&
      visitor.expectedAt > new Date()
    ) {
      throw new BadRequestException(
        `Pass not yet active — valid from ${visitor.expectedAt.toLocaleString()}`,
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

  async listFavourites(unitId: string) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.favouriteVisitor.findMany({
        where: { unitId },
        orderBy: { name: 'asc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.favouriteVisitor.count({ where: { unitId } }),
    ]);
    return { items, total };
  }

  async createFavourite(user: AuthenticatedUser, dto: CreateFavouriteVisitorDto) {
    if (!this.userCanManageUnit(user, dto.unitId)) {
      throw new ForbiddenException('You cannot manage favourites for this unit');
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException('Phone number is required for favourite visitors');
    }
    return this.prisma.favouriteVisitor.create({
      data: {
        userId: user.id,
        unitId: dto.unitId,
        name: dto.name,
        phone: dto.phone.trim(),
        phoneCountryCode: dto.phoneCountryCode ?? '+60',
        entryMode: dto.entryMode ?? VisitorEntryMode.DRIVE_IN,
        vehiclePlate: dto.vehiclePlate,
        notes: dto.notes,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async updateFavourite(id: string, user: AuthenticatedUser, dto: UpdateFavouriteVisitorDto) {
    const favourite = await this.prisma.favouriteVisitor.findUnique({ where: { id } });
    if (!favourite) throw new NotFoundException();
    if (!this.userCanManageUnit(user, favourite.unitId)) {
      throw new ForbiddenException('You cannot manage favourites for this unit');
    }
    return this.prisma.favouriteVisitor.update({
      where: { id },
      data: dto,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async deleteFavourite(id: string, user: AuthenticatedUser) {
    const favourite = await this.prisma.favouriteVisitor.findUnique({ where: { id } });
    if (!favourite) throw new NotFoundException();
    if (!this.userCanManageUnit(user, favourite.unitId)) {
      throw new ForbiddenException('You cannot manage favourites for this unit');
    }
    await this.prisma.favouriteVisitor.delete({ where: { id } });
  }

  async getVisitorSettings(condoId: string) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return parseCondoVisitorSettings(condo.settings);
  }

  async updateVisitorSettings(condoId: string, dto: UpdateVisitorSettingsDto) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const patch: Partial<CondoVisitorSettings> = {};
    if (dto.maxOvernightVisitsPerUnitPerMonth !== undefined) {
      patch.maxOvernightVisitsPerUnitPerMonth = dto.maxOvernightVisitsPerUnitPerMonth;
    }
    if (dto.overnightSlotsPerNight !== undefined) {
      patch.overnightSlotsPerNight = dto.overnightSlotsPerNight;
    }
    if (dto.walkInApprovalMinutes !== undefined) {
      patch.walkInApprovalMinutes = dto.walkInApprovalMinutes;
    }
    if (dto.preRegExpiryBufferMins !== undefined) {
      patch.preRegExpiryBufferMins = dto.preRegExpiryBufferMins;
    }
    if (dto.urgentOvernightMinHours !== undefined) {
      patch.urgentOvernightMinHours = dto.urgentOvernightMinHours;
    }
    if (dto.workingDays !== undefined) {
      patch.workingDays = {
        weekdays: dto.workingDays.weekdays.filter((d) => d >= 1 && d <= 7),
      };
    }
    if (dto.holidayAuto !== undefined) {
      patch.holidayAuto = dto.holidayAuto;
    }
    if (dto.holidayState !== undefined) {
      patch.holidayState = dto.holidayState;
    }
    if (dto.customHolidays !== undefined) {
      patch.customHolidays = dto.customHolidays;
    }
    if (dto.holidayExclusions !== undefined) {
      patch.holidayExclusions = dto.holidayExclusions;
    }
    // Legacy flat list: treat as manual custom additions when explicit fields are absent.
    if (dto.publicHolidays !== undefined && dto.customHolidays === undefined) {
      patch.customHolidays = dto.publicHolidays;
    }
    if (dto.holidayOvernightAutoApprove !== undefined) {
      patch.holidayOvernightAutoApprove = dto.holidayOvernightAutoApprove;
    }
    if (dto.countPendingTowardCap !== undefined) {
      patch.countPendingTowardCap = dto.countPendingTowardCap;
    }
    if (dto.requirePlatePhotoOvernight !== undefined) {
      patch.requirePlatePhotoOvernight = dto.requirePlatePhotoOvernight;
    }
    if (dto.defaultPurpose !== undefined) {
      patch.defaultPurpose = dto.defaultPurpose;
    }
    const settings = mergeVisitorSettings(condo.settings, patch);
    await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    return parseCondoVisitorSettings(settings);
  }

  async getOvernightOwnerSummary(condoId: string, month?: string) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const range = parseMonthParam(month);
    const settings = parseCondoVisitorSettings(condo.settings);

    const units = await this.prisma.unit.findMany({
      where: { condoId },
      include: {
        ownerships: {
          where: { status: OwnershipStatus.ACTIVE },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ isPrimary: 'desc' }, { startDate: 'asc' }],
        },
      },
      orderBy: { identifier: 'asc' },
    });

    const rows = await Promise.all(
      units.map(async (unit) => {
        const count = await countMonthlyOvernightForUnit(this.prisma, unit.id, range, settings);
        const policy = await getUnitSuspendPolicy(this.prisma, unit.id);
        const suspended = isOvernightSuspended(policy);
        const owners = unit.ownerships.map((o) => ({
          id: o.userId,
          name: o.user.name,
          email: o.user.email,
          isPrimary: o.isPrimary,
        }));
        return {
          unitId: unit.id,
          unitIdentifier: unit.identifier,
          owners,
          overnightCountThisMonth: count,
          monthlyLimit: settings.maxOvernightVisitsPerUnitPerMonth,
          status: suspended ? ('suspended' as const) : ('active' as const),
          overnightSuspendedUntil: policy?.overnightSuspendedUntil ?? null,
          suspendedIndefinite: isIndefiniteSuspend(policy?.overnightSuspendedUntil),
          suspendReason: policy?.suspendReason ?? null,
        };
      }),
    );

    return { month: range.key, items: rows, settings };
  }

  async suspendUnitOvernight(
    condoId: string,
    unitId: string,
    actor: AuthenticatedUser,
    dto: SuspendOvernightDto,
  ) {
    if (!this.userIsManagement(actor, condoId)) {
      throw new ForbiddenException('Only management can suspend overnight registration');
    }
    const owner = await getPrimaryUnitOwner(this.prisma, unitId);
    if (!owner) throw new BadRequestException('No active owner found for this unit');

    let until: Date;
    if (dto.indefinite) {
      until = INDEFINITE_SUSPEND_UNTIL;
    } else if (dto.until) {
      until = dto.until;
    } else {
      throw new BadRequestException('Provide until date or set indefinite to suspend until lifted');
    }

    const policy = await this.prisma.unitVisitorPolicy.upsert({
      where: { unitId_userId: { unitId, userId: owner.userId } },
      create: {
        condoId,
        unitId,
        userId: owner.userId,
        overnightSuspendedUntil: until,
        suspendReason: dto.reason.trim(),
      },
      update: {
        overnightSuspendedUntil: until,
        suspendReason: dto.reason.trim(),
      },
    });

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        actorUserId: actor.id,
        actorRole: actor.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'UnitVisitorPolicy',
        resourceId: policy.id,
        metadata: {
          action: 'suspend_overnight',
          until: until.toISOString(),
          indefinite: dto.indefinite ?? false,
          reason: dto.reason,
        },
      },
    });

    const residentIds = await this.unitResidentUserIds(unitId);
    const untilLabel = dto.indefinite
      ? 'until lifted by management'
      : `until ${until.toLocaleDateString('en-MY')}`;
    await this.notifications.dispatch({
      userIds: residentIds,
      kind: NotificationKind.ACCESS_REVOKED,
      title: 'Overnight visitor registration suspended',
      body: `Unit ${unit?.identifier ?? unitId}: overnight registration is suspended ${untilLabel}. Reason: ${dto.reason.trim()}`,
      data: { unitId, policyId: policy.id, action: 'overnight_suspended' },
    });

    return policy;
  }

  async unsuspendUnitOvernight(condoId: string, unitId: string, actor: AuthenticatedUser) {
    if (!this.userIsManagement(actor, condoId)) {
      throw new ForbiddenException('Only management can restore overnight registration');
    }
    const policies = await this.prisma.unitVisitorPolicy.findMany({ where: { unitId } });
    const active = policies.filter((p) => isOvernightSuspended(p));
    if (active.length === 0) {
      return { unitId, overnightSuspendedUntil: null, suspendReason: null };
    }

    await this.prisma.unitVisitorPolicy.updateMany({
      where: { id: { in: active.map((p) => p.id) } },
      data: { overnightSuspendedUntil: null, suspendReason: null },
    });

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    for (const policy of active) {
      await this.prisma.auditLog.create({
        data: {
          condoId,
          unitId,
          actorUserId: actor.id,
          actorRole: actor.activeRole,
          action: AuditAction.UPDATE,
          resourceType: 'UnitVisitorPolicy',
          resourceId: policy.id,
          metadata: { action: 'unsuspend_overnight' },
        },
      });
    }

    const residentIds = await this.unitResidentUserIds(unitId);
    await this.notifications.dispatch({
      userIds: residentIds,
      kind: NotificationKind.ACCESS_GRANTED,
      title: 'Overnight visitor registration restored',
      body: `Unit ${unit?.identifier ?? unitId}: you may register overnight visitors again.`,
      data: { unitId, action: 'overnight_unsuspended' },
    });

    return { unitId, overnightSuspendedUntil: null, suspendReason: null };
  }

  async flagPlateMismatch(visitorId: string, actor: AuthenticatedUser, dto: FlagPlateMismatchDto) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { unit: true },
    });
    if (!visitor) throw new NotFoundException();
    if (!this.userIsManagement(actor, visitor.condoId)) {
      throw new ForbiddenException('Only management can flag plate mismatches');
    }

    const updated = await this.prisma.visitor.update({
      where: { id: visitorId },
      data: { plateMismatchFlagged: true },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: visitor.condoId,
        unitId: visitor.unitId,
        actorUserId: actor.id,
        actorRole: actor.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'Visitor',
        resourceId: visitorId,
        metadata: {
          action: 'plate_mismatch_flagged',
          reason: dto.reason ?? null,
          vehiclePlate: visitor.vehiclePlate,
        },
      },
    });

    if (dto.suspendOwner && visitor.unitId) {
      await this.suspendUnitOvernight(visitor.condoId, visitor.unitId, actor, {
        reason: dto.reason?.trim() || 'Plate number did not match photo evidence',
        indefinite: true,
      });
    }

    return updated;
  }
}
