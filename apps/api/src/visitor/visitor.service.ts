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
  DeliveryPlatform,
  NotificationKind,
  OwnershipStatus,
  type Prisma,
  RoleId,
  TenancyStatus,
  VisitorEntryMode,
  VisitorPassKind,
  VisitorPurpose,
  VisitorStatus,
  VisitorVisitType,
} from '@prisma/client';
import {
  defaultQuickEntryPassName,
  formatUnitLabel,
  isValidMalaysiaPhone,
  normalizeMalaysiaPhone,
  resolveMalaysiaPhoneE164,
} from '@smartresidence/shared-types';
import * as QRCode from 'qrcode';
import {
  buildQrPayload,
  generateAccessCode,
  isVisitorId,
  normalizePassInput,
  parseQrPayload,
} from './access-code';
import { condoDayBounds } from './condo-timezone';
import type {
  CheckInVisitorDto,
  CreateDeliveryPassDto,
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
  countMonthlyOvernightByUnit,
  getPrimaryUnitOwner,
  getUnitOwnerContacts,
  getUnitSuspendPolicyByUnit,
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
  DEFAULT_DELIVERY_DURATION_MINS,
  DEFAULT_E_HAILING_DURATION_MINS,
  DEFAULT_VISIT_DURATION_MINS,
  HISTORY_VISITOR_STATUSES,
  QUICK_ENTRY_EXPIRY_BUFFER_MINS,
  UPCOMING_VISITOR_STATUSES,
  type VisitorAdminFilter,
  type VisitorListView,
  WALK_IN_CHECK_IN_WINDOW_MINS,
  statusesForView,
} from './visitor.constants';

const CHECK_IN_ALLOWED: VisitorStatus[] = [VisitorStatus.APPROVED];

/**
 * How a guard cleared a pending unit walk-in at the gate:
 * - OWNER_BY_PHONE: guard phoned the owner who verbally confirmed
 * - GUARD_MANUAL: guard judged the visitor legitimate and approved directly
 */
export type GuardApprovalMethod = 'OWNER_BY_PHONE' | 'GUARD_MANUAL';
export const GUARD_APPROVAL_METHODS: GuardApprovalMethod[] = ['OWNER_BY_PHONE', 'GUARD_MANUAL'];

const visitorUserSelect = { id: true, name: true, phone: true } as const;

const visitorInclude = {
  unit: {
    include: {
      block: true,
      ownerships: {
        where: { status: OwnershipStatus.ACTIVE },
        include: { user: { select: visitorUserSelect } },
      },
    },
  },
  host: { select: visitorUserSelect },
  checkIns: {
    include: {
      checkInGuard: { select: visitorUserSelect },
      checkOutGuard: { select: visitorUserSelect },
    },
  },
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

  private computeQuickEntryExpiresAt(expectedAt: Date, durationMins: number): Date {
    return this.addMinutes(expectedAt, durationMins + QUICK_ENTRY_EXPIRY_BUFFER_MINS);
  }

  private quickEntryDurationMins(
    passKind: Exclude<VisitorPassKind, 'STANDARD'>,
    requested?: number,
  ): number {
    if (requested != null) return requested;
    return passKind === VisitorPassKind.E_HAILING
      ? DEFAULT_E_HAILING_DURATION_MINS
      : DEFAULT_DELIVERY_DURATION_MINS;
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
      const [visitor, recurring, form] = await Promise.all([
        this.prisma.visitor.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
        this.prisma.recurringPass.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
        this.prisma.formSubmission.findUnique({
          where: { condoId_accessCode: { condoId, accessCode } },
          select: { id: true },
        }),
      ]);
      if (!visitor && !recurring && !form) return accessCode;
    }
    throw new BadRequestException('Could not allocate access code — try again');
  }

  private passFields(condoId: string, visitorId: string, accessCode: string) {
    const qrPayload = buildQrPayload(condoId, visitorId, accessCode);
    return { accessCode, qrPayload, qrCode: qrPayload };
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

    await Promise.all([
      this.prisma.visitor.updateMany({
        where: {
          ...scope,
          status: VisitorStatus.PENDING_OWNER_APPROVAL,
          approvalDeadline: { lt: now },
        },
        data: { status: VisitorStatus.EXPIRED },
      }),
      this.prisma.visitor.updateMany({
        where: {
          ...scope,
          status: VisitorStatus.APPROVED,
          expiresAt: { lt: now },
          visitType: { in: [VisitorVisitType.PRE_REG, VisitorVisitType.WALKIN_UNIT] },
        },
        data: { status: VisitorStatus.EXPIRED },
      }),
    ]);
  }

  /** Walk-ins and day visits auto check-out at end of condo calendar day (no guard action). */
  async autoCloseStaleVisitors(condoId: string, now = new Date()): Promise<number> {
    const tz = await this.condoTimezone(condoId);
    const { start: dayStart } = condoDayBounds(tz, now);
    const open = await this.prisma.visitor.findMany({
      where: {
        condoId,
        status: VisitorStatus.CHECKED_IN,
        checkIns: { some: { checkOutAt: null } },
      },
      include: {
        checkIns: {
          where: { checkOutAt: null },
          orderBy: { checkInAt: 'desc' },
          take: 1,
        },
      },
    });

    let closed = 0;
    for (const visitor of open) {
      const active = visitor.checkIns[0];
      if (!active) continue;
      const closeAt = this.resolveAutoCloseAt(visitor, active.checkInAt, dayStart, now);
      if (!closeAt) continue;

      await this.prisma.visitorCheckIn.update({
        where: { id: active.id },
        data: { checkOutAt: closeAt, checkOutGuardId: null },
      });
      await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: { status: VisitorStatus.CHECKED_OUT },
      });
      this.events.emit('visitor.checked_out', {
        visitorId: visitor.id,
        condoId,
        auto: true,
      });
      closed++;
    }
    return closed;
  }

  /** @deprecated Use autoCloseStaleVisitors — kept as alias for internal callers. */
  private async autoCloseStaleWalkIns(condoId: string, now = new Date()) {
    await this.autoCloseStaleVisitors(condoId, now);
  }

  /**
   * When to system-close an open check-in. Returns null if the visit should stay open.
   * Overnight pre-reg may span midnight until expiresAt; walk-ins always close at day boundary.
   */
  private resolveAutoCloseAt(
    visitor: {
      visitType: VisitorVisitType;
      overnight: boolean;
      expiresAt: Date | null;
    },
    checkInAt: Date,
    dayStart: Date,
    now: Date,
  ): Date | null {
    const isWalkIn =
      visitor.visitType === VisitorVisitType.WALKIN_UNIT ||
      visitor.visitType === VisitorVisitType.WALKIN_OFFICE;

    if (isWalkIn) {
      return checkInAt < dayStart ? dayStart : null;
    }

    if (visitor.overnight) {
      if (visitor.expiresAt && visitor.expiresAt > now) return null;
      if (visitor.expiresAt && visitor.expiresAt <= now) return visitor.expiresAt;
    }

    return checkInAt < dayStart ? dayStart : null;
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
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private userIsCondoMember(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
  }

  /** Household-scoped access OR management access to the unit's condo. */
  private async assertUnitAccess(user: AuthenticatedUser, unitId: string): Promise<void> {
    if (this.userCanManageUnit(user, unitId)) return;
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { condoId: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (!this.userIsManagement(user, unit.condoId)) {
      throw new ForbiddenException('You cannot access visitors for this unit');
    }
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

    this.normalizeMalaysiaPhoneField(dto.phone, true);

    if (overnight && dto.entryMode === VisitorEntryMode.WALK_IN) {
      throw new BadRequestException(
        'Overnight stays are only for drive-in pre-registrations — vehicle park overnight',
      );
    }

    const entryMode = overnight
      ? VisitorEntryMode.DRIVE_IN
      : (dto.entryMode ?? VisitorEntryMode.DRIVE_IN);

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

  async overnightPreview(user: AuthenticatedUser, condoId: string, expectedAt: Date) {
    if (!this.userIsCondoMember(user, condoId)) {
      throw new ForbiddenException('You cannot access overnight rules for this condo');
    }
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
    if (!this.userCanManageUnit(user, unit.id)) {
      throw new ForbiddenException('You can only pre-register visitors for your own units');
    }

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

    const phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;

    const visitor = await this.prisma.visitor.create({
      data: {
        condoId: unit.condoId,
        visitType: VisitorVisitType.PRE_REG,
        unitId: unit.id,
        hostUserId: user.id,
        name: dto.name,
        identification: dto.identification,
        phone,
        phoneCountryCode: '+60',
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

  /** Quick-entry pass for food delivery riders or e-hailing drivers — shorter validity, no phone required. */
  async createDeliveryPass(user: AuthenticatedUser, dto: CreateDeliveryPassDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { condo: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (!this.userCanManageUnit(user, unit.id)) {
      throw new ForbiddenException('You can only create passes for your own units');
    }

    const passKind = dto.passKind as Exclude<VisitorPassKind, 'STANDARD'>;
    const duration = this.quickEntryDurationMins(passKind, dto.expectedDurationMins);
    const plate = dto.vehiclePlate?.trim() || null;
    const entryMode = plate ? VisitorEntryMode.DRIVE_IN : VisitorEntryMode.WALK_IN;
    const name =
      dto.name?.trim() || defaultQuickEntryPassName(passKind, dto.platform as DeliveryPlatform);
    const now = new Date();
    const accessCode = await this.uniqueAccessCode(unit.condoId);
    const expiresAt = this.computeQuickEntryExpiresAt(dto.expectedAt, duration);

    const visitor = await this.prisma.visitor.create({
      data: {
        condoId: unit.condoId,
        visitType: VisitorVisitType.PRE_REG,
        passKind,
        deliveryPlatform: dto.platform,
        unitId: unit.id,
        hostUserId: user.id,
        name,
        phone: null,
        phoneCountryCode: '+60',
        entryMode,
        vehiclePlate: plate,
        purpose:
          passKind === VisitorPassKind.DELIVERY ? VisitorPurpose.DELIVERY : VisitorPurpose.VISITOR,
        overnight: false,
        expectedAt: dto.expectedAt,
        expectedDurationMins: duration,
        status: VisitorStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: now,
        expiresAt,
        accessCode,
        qrPayload: buildQrPayload(unit.condoId, 'pending', accessCode),
        qrCode: null,
      },
    });

    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: this.passFields(unit.condoId, visitor.id, accessCode),
    });

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

  private readonly malaysiaPhoneError =
    'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)';

  private normalizeMalaysiaPhoneField(phone?: string | null, required = false): string | null {
    if (!phone?.trim()) {
      if (required) throw new BadRequestException('Phone number is required for visitors');
      return null;
    }
    const normalized = normalizeMalaysiaPhone(phone);
    if (!isValidMalaysiaPhone(normalized)) {
      throw new BadRequestException(this.malaysiaPhoneError);
    }
    return normalized;
  }

  private resolveVisitorPhoneForGuard(
    phone?: string | null,
    phoneCountryCode?: string | null,
  ): string | null {
    return resolveMalaysiaPhoneE164(phone, phoneCountryCode) ?? phone?.trim() ?? null;
  }

  async createWalkInUnit(guard: AuthenticatedUser, dto: CreateWalkInUnitDto) {
    this.assertGateOperator(guard);
    this.rejectWalkInOvernight(dto.overnight);
    const condoId = this.guardCondoId(guard);
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, condoId },
      include: { condo: true },
    });
    if (!unit) throw new NotFoundException('Unit not found in this condo');

    const settings = parseCondoVisitorSettings(unit.condo.settings);
    // Guard on-site discretion: admit the walk-in immediately, bypassing the
    // owner pre-registration/approval step regardless of condo policy. The guard
    // takes accountability — recorded against their user id + an owner heads-up.
    if (dto.admitNow) {
      return this.createWalkInUnitImmediateCheckIn(guard, condoId, unit.id, dto, {
        guardAdmitted: true,
      });
    }
    if (!settings.walkInRequireOwnerApproval) {
      return this.createWalkInUnitImmediateCheckIn(guard, condoId, unit.id, dto);
    }

    const approvalDeadline = this.addMinutes(new Date(), walkInApprovalMinutes(settings));
    const phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;
    const visitor = await this.prisma.visitor.create({
      data: {
        condoId,
        visitType: VisitorVisitType.WALKIN_UNIT,
        unitId: unit.id,
        hostUserId: null,
        name: dto.name,
        phone,
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
    return this.enrichWalkInOwnerContacts(visitor, unit.id);
  }

  private isGuard(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => r.roleId === RoleId.SECURITY_GUARD);
  }

  /** Gate ops (walk-in / check-in / check-out) are guard-only — never management or residents. */
  private assertGateOperator(user: AuthenticatedUser): void {
    const allowed = user.roles.some(
      (r) => r.roleId === RoleId.SUPER_ADMIN || r.roleId === RoleId.SECURITY_GUARD,
    );
    if (!allowed) {
      throw new ForbiddenException('Only security guards can perform gate operations');
    }
  }

  private async condoTimezone(condoId: string): Promise<string> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { timezone: true },
    });
    return condo?.timezone ?? 'Asia/Kuala_Lumpur';
  }

  /** Guards may only see today's expected visitors or past history — never future pre-reg. */
  private async guardCondoListWhere(
    condoId: string,
    opts: {
      status?: VisitorStatus;
      view?: VisitorListView;
      statusFilter: Prisma.VisitorWhereInput;
      adminFilter: Prisma.VisitorWhereInput;
    },
  ): Promise<Prisma.VisitorWhereInput> {
    if (opts.view === 'upcoming') {
      throw new BadRequestException('Guards cannot list future expected visitors');
    }

    const { start, end } = condoDayBounds(await this.condoTimezone(condoId));
    const noFuture: Prisma.VisitorWhereInput = { expectedAt: { lt: end } };

    if (opts.view === 'history') {
      return {
        condoId,
        ...opts.adminFilter,
        AND: [
          noFuture,
          {
            OR: [{ expectedAt: { lt: start } }, { status: { in: HISTORY_VISITOR_STATUSES } }],
          },
        ],
      };
    }

    if (opts.view === 'live') {
      return { condoId, ...opts.statusFilter, ...opts.adminFilter, ...noFuture };
    }

    if (opts.view === 'expected') {
      return {
        condoId,
        ...opts.adminFilter,
        expectedAt: { gte: start, lt: end },
        status: { in: UPCOMING_VISITOR_STATUSES },
      };
    }

    if (opts.view === 'no_show') {
      return {
        condoId,
        ...opts.adminFilter,
        expectedAt: { gte: start, lt: end },
        status: VisitorStatus.EXPIRED,
      };
    }

    const todayActive: Prisma.VisitorWhereInput = opts.status
      ? { status: opts.status }
      : { status: { notIn: HISTORY_VISITOR_STATUSES } };

    return {
      condoId,
      ...todayActive,
      ...opts.adminFilter,
      expectedAt: { gte: start, lt: end },
    };
  }

  private async enrichWalkInOwnerContacts<
    T extends { status: VisitorStatus; unitId: string | null },
  >(
    visitor: T,
    unitId: string,
  ): Promise<T & { ownerContacts?: Awaited<ReturnType<typeof getUnitOwnerContacts>> }> {
    if (visitor.status !== VisitorStatus.PENDING_OWNER_APPROVAL) return visitor;
    const ownerContacts = await getUnitOwnerContacts(this.prisma, unitId);
    return { ...visitor, ownerContacts };
  }

  /**
   * Batched owner-contact lookup: one query for many units instead of one per
   * visitor (avoids N+1 on guard list / live board endpoints).
   */
  private async getUnitOwnerContactsMap(
    unitIds: Array<string | null | undefined>,
  ): Promise<Map<string, Awaited<ReturnType<typeof getUnitOwnerContacts>>>> {
    const map = new Map<string, Awaited<ReturnType<typeof getUnitOwnerContacts>>>();
    const ids = [...new Set(unitIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return map;
    const ownerships = await this.prisma.ownership.findMany({
      where: { unitId: { in: ids }, status: OwnershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'asc' }],
    });
    for (const o of ownerships) {
      const list = map.get(o.unitId) ?? [];
      list.push({ id: o.user.id, name: o.user.name, phone: o.user.phone, isPrimary: o.isPrimary });
      map.set(o.unitId, list);
    }
    return map;
  }

  private async enrichGuardVisitorList(
    items: VisitorWithRelations[],
    viewer?: AuthenticatedUser,
  ): Promise<
    Array<
      VisitorWithRelations & { ownerContacts?: Awaited<ReturnType<typeof getUnitOwnerContacts>> }
    >
  > {
    if (!viewer || !this.isGuard(viewer)) return items;
    const contactsMap = await this.getUnitOwnerContactsMap(
      items.filter((v) => v.status === VisitorStatus.PENDING_OWNER_APPROVAL).map((v) => v.unitId),
    );
    return items.map((v) => {
      const phone = this.resolveVisitorPhoneForGuard(v.phone, v.phoneCountryCode);
      if (v.status !== VisitorStatus.PENDING_OWNER_APPROVAL || !v.unitId) {
        return phone === v.phone ? v : { ...v, phone };
      }
      const ownerContacts = contactsMap.get(v.unitId) ?? [];
      return { ...v, phone, ownerContacts };
    });
  }

  async getWalkInOwnerContacts(visitorId: string, guard: AuthenticatedUser) {
    const condoId = this.guardCondoId(guard);
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || visitor.condoId !== condoId) {
      throw new NotFoundException('Visitor not found');
    }
    if (visitor.visitType !== VisitorVisitType.WALKIN_UNIT) {
      throw new BadRequestException('Only unit walk-in visitors have owner contacts');
    }
    if (visitor.status !== VisitorStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException('Owner contacts are only available while awaiting approval');
    }
    if (!visitor.unitId) throw new BadRequestException('Visitor has no unit');
    const ownerContacts = await getUnitOwnerContacts(this.prisma, visitor.unitId);
    return { visitorId, ownerContacts };
  }

  /**
   * Record an immediate unit walk-in check-in (no QR pass, no owner wait).
   * Two callers:
   * - condo policy has owner approval disabled (`walkInRequireOwnerApproval=false`)
   * - guard on-site discretion (`opts.guardAdmitted`) — the guard admits a
   *   visitor (e.g. a contractor) on the spot regardless of policy, takes
   *   accountability (`admittedByGuardUserId`), and the unit owner gets a
   *   transparency heads-up notification.
   */
  private async createWalkInUnitImmediateCheckIn(
    guard: AuthenticatedUser,
    condoId: string,
    unitId: string,
    dto: CreateWalkInUnitDto,
    opts: { guardAdmitted?: boolean } = {},
  ) {
    const guardAdmitted = opts.guardAdmitted === true;
    const photoUrl = dto.photoUrl?.trim() || undefined;
    const phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;
    const now = new Date();
    const purposeNote = dto.purpose?.trim() ? `Purpose: ${dto.purpose.trim()}` : null;
    const checkInNote = guardAdmitted
      ? ['Walk-in admitted at gate by guard (on-site discretion)', purposeNote]
          .filter(Boolean)
          .join(' · ')
      : purposeNote;

    const visitor = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          condoId,
          visitType: VisitorVisitType.WALKIN_UNIT,
          unitId,
          hostUserId: null,
          name: dto.name,
          phone,
          vehiclePlate: dto.vehiclePlate,
          purpose: this.mapWalkInPurpose(dto.purpose),
          overnight: false,
          expectedAt: now,
          status: VisitorStatus.CHECKED_IN,
          ...(guardAdmitted
            ? { admittedByGuardUserId: guard.id, approvedByUserId: guard.id, approvedAt: now }
            : {}),
          metadata: {
            createdByGuardId: guard.id,
            singleVisit: true,
            ownerApprovalSkipped: true,
            ...(guardAdmitted
              ? {
                  admissionSource: 'GUARD_WALK_IN',
                  admittedByGuardId: guard.id,
                  guardAdmittedAt: now.toISOString(),
                  ...(photoUrl ? { admitPhotoUrl: photoUrl } : {}),
                }
              : {}),
          },
        },
      });
      const checkIn = await tx.visitorCheckIn.create({
        data: {
          visitorId: v.id,
          checkInGuardId: guard.id,
          gateLocation: 'Main gate',
          notes: checkInNote,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId,
          unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'Visitor',
          resourceId: v.id,
          metadata: {
            visitType: 'WALKIN_UNIT',
            status: 'CHECKED_IN',
            ownerApprovalSkipped: true,
            ...(guardAdmitted ? { admittedByGuard: true, admissionSource: 'GUARD_WALK_IN' } : {}),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          condoId,
          unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'VisitorCheckIn',
          resourceId: checkIn.id,
          metadata: {
            visitType: 'WALKIN_UNIT',
            ownerApprovalSkipped: true,
            ...(guardAdmitted ? { admittedByGuard: true } : {}),
          },
        },
      });
      return v;
    });

    // Guard-admitted walk-ins notify the unit owner (transparency); the
    // policy-driven path keeps its existing checked-in event behaviour.
    this.events.emit(guardAdmitted ? 'visitor.walk_in_admitted' : 'visitor.checked_in', {
      visitorId: visitor.id,
      condoId,
    });
    return visitor;
  }

  async getGuardWalkInPolicy(guard: AuthenticatedUser) {
    const condoId = this.guardCondoId(guard);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const settings = parseCondoVisitorSettings(condo.settings);
    return {
      walkInRequireOwnerApproval: settings.walkInRequireOwnerApproval,
      walkInApprovalMinutes: settings.walkInApprovalMinutes,
    };
  }

  async createWalkInOffice(guard: AuthenticatedUser, dto: CreateWalkInOfficeDto) {
    this.assertGateOperator(guard);
    this.rejectWalkInOvernight(dto.overnight);
    const condoId = this.guardCondoId(guard);
    if (!dto.purpose?.trim()) {
      throw new BadRequestException('Purpose is required for management office visitors');
    }

    const phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;
    const visitor = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          condoId,
          visitType: VisitorVisitType.WALKIN_OFFICE,
          unitId: null,
          hostUserId: null,
          name: dto.name,
          phone,
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

  /**
   * Guard clears a pending unit walk-in at the gate without waiting for the owner's
   * in-app response (no deadlock). The visitor is physically present, so this
   * approves AND checks them in atomically — they go straight to on-site (CHECKED_IN),
   * never landing in Expected or being flagged overdue. The approval method
   * (owner-by-phone vs guard-manual) is recorded on the visitor and in the audit log.
   */
  async approveWalkInByGuard(
    visitorId: string,
    guard: AuthenticatedUser,
    method: GuardApprovalMethod,
  ) {
    this.assertGateOperator(guard);
    const condoId = this.guardCondoId(guard);
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || visitor.condoId !== condoId) {
      throw new NotFoundException('Visitor not found');
    }
    if (visitor.visitType !== VisitorVisitType.WALKIN_UNIT) {
      throw new BadRequestException('Only unit walk-in visitors can be approved at the gate');
    }
    if (visitor.status !== VisitorStatus.PENDING_OWNER_APPROVAL) {
      throw new BadRequestException(
        visitor.status === VisitorStatus.EXPIRED
          ? 'Approval window expired — re-register the visitor'
          : `Visitor is ${visitor.status}, not awaiting approval`,
      );
    }

    const now = new Date();
    const existingMetadata =
      visitor.metadata && typeof visitor.metadata === 'object' && !Array.isArray(visitor.metadata)
        ? (visitor.metadata as Record<string, unknown>)
        : {};
    const methodNote =
      method === 'OWNER_BY_PHONE'
        ? 'Owner approved by phone (guard-recorded)'
        : 'Approved at gate by guard (verified visitor)';

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.update({
        where: { id: visitorId },
        data: {
          status: VisitorStatus.CHECKED_IN,
          approvedByUserId: guard.id,
          approvedAt: now,
          metadata: {
            ...existingMetadata,
            approvalMethod: method,
            approvedByGuardId: guard.id,
            guardApprovedAt: now.toISOString(),
          },
        },
      });
      const checkIn = await tx.visitorCheckIn.create({
        data: {
          visitorId: v.id,
          checkInGuardId: guard.id,
          gateLocation: 'Main gate',
          notes: methodNote,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: visitor.condoId,
          unitId: visitor.unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.UPDATE,
          resourceType: 'Visitor',
          resourceId: visitorId,
          metadata: { decision: 'guard_approved', method, autoCheckIn: true },
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
          metadata: { visitType: 'WALKIN_UNIT', approvalMethod: method },
        },
      });
      return v;
    });

    this.events.emit('visitor.checked_in', { visitorId, condoId: visitor.condoId });
    return updated;
  }

  /**
   * Guard records entry for an owner-approved unit walk-in — no QR/access pass.
   * Used when the owner responded in-app while the visitor waits at the gate.
   */
  async acknowledgeWalkIn(visitorId: string, guard: AuthenticatedUser, dto: CheckInVisitorDto) {
    this.assertGateOperator(guard);
    const condoId = this.guardCondoId(guard);
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || visitor.condoId !== condoId) {
      throw new NotFoundException('Visitor not found');
    }
    if (visitor.visitType !== VisitorVisitType.WALKIN_UNIT) {
      throw new BadRequestException('Only unit walk-in visitors can be acknowledged at the gate');
    }
    if (visitor.status !== VisitorStatus.APPROVED) {
      throw new BadRequestException(
        visitor.status === VisitorStatus.CHECKED_IN
          ? 'Visitor already acknowledged on site'
          : `Visitor is ${visitor.status}, not awaiting gate acknowledgment`,
      );
    }
    if (visitor.expiresAt && visitor.expiresAt < new Date()) {
      await this.prisma.visitor.update({
        where: { id: visitorId },
        data: { status: VisitorStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Owner approval window expired — ask the resident to re-register the visitor',
      );
    }

    const checkIn = await this.prisma.$transaction(async (tx) => {
      await tx.visitor.update({
        where: { id: visitorId },
        data: { status: VisitorStatus.CHECKED_IN },
      });
      const row = await tx.visitorCheckIn.create({
        data: {
          visitorId,
          checkInGuardId: guard.id,
          gateLocation: dto.gateLocation ?? 'Main gate',
          notes: dto.notes ?? 'Walk-in acknowledged at gate (owner approved in app)',
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
          resourceId: row.id,
          metadata: { visitType: 'WALKIN_UNIT', acknowledgment: true },
        },
      });
      return row;
    });

    this.events.emit('visitor.checked_in', { visitorId, condoId: visitor.condoId });
    return checkIn;
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

  async getQrPng(visitorId: string, user: AuthenticatedUser) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    // AbilitiesGuard only checks bare `read Visitor` — enforce unit/condo scope here.
    const condoScoped =
      this.userIsManagement(user, visitor.condoId) ||
      this.isGuard(user) ||
      user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (visitor.unitId) {
      if (!condoScoped) await this.assertUnitAccess(user, visitor.unitId);
    } else if (!condoScoped) {
      throw new ForbiddenException('You cannot view this visitor pass');
    }
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
    user: AuthenticatedUser,
    unitId: string,
    opts: { limit: number; offset: number; view?: VisitorListView; status?: VisitorStatus },
  ) {
    await this.assertUnitAccess(user, unitId);
    const viewStatuses = statusesForView(opts.view);
    const statusFilter = opts.status
      ? { status: opts.status }
      : viewStatuses
        ? { status: { in: viewStatuses } }
        : {};
    const where = { unitId, ...statusFilter };
    const orderBy =
      opts.view === 'live' ? { updatedAt: 'desc' as const } : { expectedAt: 'desc' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        orderBy,
        take: opts.limit,
        skip: opts.offset,
        include: visitorInclude,
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return { items, total, ...opts };
  }

  private buildVisitorSearchFilter(search?: string): Prisma.VisitorWhereInput {
    const term = search?.trim();
    if (!term) return {};
    return {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { accessCode: { contains: term, mode: 'insensitive' } },
        { vehiclePlate: { contains: term, mode: 'insensitive' } },
        { unit: { identifier: { contains: term, mode: 'insensitive' } } },
      ],
    };
  }

  async getAdminVisitorStats(user: AuthenticatedUser, condoId: string) {
    if (!this.userIsManagement(user, condoId)) {
      throw new ForbiddenException('You cannot view visitor stats for this condo');
    }
    const tz = await this.condoTimezone(condoId);
    const { start, end } = condoDayBounds(tz);
    const [
      onSiteCount,
      expectedToday,
      checkInsToday,
      walkInsToday,
      pendingOvernight,
      pendingOwnerApproval,
    ] = await Promise.all([
      this.prisma.visitor.count({
        where: { condoId, status: VisitorStatus.CHECKED_IN },
      }),
      this.prisma.visitor.count({
        where: {
          condoId,
          expectedAt: { gte: start, lt: end },
          status: { in: UPCOMING_VISITOR_STATUSES },
        },
      }),
      this.prisma.visitorCheckIn.count({
        where: {
          visitor: { condoId },
          checkInAt: { gte: start, lt: end },
        },
      }),
      this.prisma.visitor.count({
        where: {
          condoId,
          visitType: { in: [VisitorVisitType.WALKIN_UNIT, VisitorVisitType.WALKIN_OFFICE] },
          createdAt: { gte: start, lt: end },
        },
      }),
      this.prisma.visitor.count({
        where: {
          condoId,
          overnight: true,
          status: VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
        },
      }),
      this.prisma.visitor.count({
        where: { condoId, status: VisitorStatus.PENDING_OWNER_APPROVAL },
      }),
    ]);
    return {
      onSiteCount,
      expectedToday,
      checkInsToday,
      walkInsToday,
      pendingOvernight,
      pendingOwnerApproval,
    };
  }

  async listForCondo(
    condoId: string,
    opts: {
      limit: number;
      offset: number;
      status?: VisitorStatus;
      view?: VisitorListView;
      filter?: VisitorAdminFilter;
      search?: string;
      unitId?: string;
      from?: Date;
      to?: Date;
      viewer?: AuthenticatedUser;
    },
  ) {
    if (opts.viewer) {
      if (!this.userIsCondoMember(opts.viewer, condoId)) {
        throw new ForbiddenException('You cannot view visitors for this condo');
      }
      // Condo-wide log is management audit + guard gate duty — not resident-scoped.
      const canListCondo =
        this.userIsManagement(opts.viewer, condoId) ||
        this.isGuard(opts.viewer) ||
        opts.viewer.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
      if (!canListCondo) {
        throw new ForbiddenException('You cannot view the condo-wide visitor log');
      }
    }
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
    const dateFilter =
      opts.from || opts.to
        ? {
            expectedAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {};
    const unitFilter = opts.unitId ? { unitId: opts.unitId } : {};
    const searchFilter = this.buildVisitorSearchFilter(opts.search);
    const baseWhere: Prisma.VisitorWhereInput =
      opts.viewer && this.isGuard(opts.viewer)
        ? await this.guardCondoListWhere(condoId, {
            status: opts.status,
            view: opts.view,
            statusFilter,
            adminFilter,
          })
        : { condoId, ...statusFilter, ...adminFilter, ...dateFilter, ...unitFilter };
    const where: Prisma.VisitorWhereInput =
      Object.keys(searchFilter).length > 0 ? { AND: [baseWhere, searchFilter] } : baseWhere;
    const guardExpectedView =
      opts.viewer &&
      this.isGuard(opts.viewer) &&
      (opts.view === 'expected' || opts.view === 'no_show');
    const orderBy =
      guardExpectedView && opts.view === 'expected'
        ? { expectedAt: 'asc' as const }
        : { expectedAt: 'desc' as const };
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        orderBy,
        take: opts.limit,
        skip: opts.offset,
        include: visitorInclude,
      }),
      this.prisma.visitor.count({ where }),
    ]);
    const items = guardExpectedView
      ? rawItems.map((v) => this.toGuardExpectedVisitor(v))
      : await this.enrichGuardVisitorList(rawItems, opts.viewer);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  /** Checked-in visitors on site — privacy-scoped for guard gate duty. */
  async listLiveForGuard(guard: AuthenticatedUser) {
    const condoId = this.guardCondoId(guard);
    await this.autoCloseStaleVisitors(condoId);
    const rawItems = await this.prisma.visitor.findMany({
      where: { condoId, status: VisitorStatus.CHECKED_IN },
      include: visitorInclude,
    });
    const contactsMap = await this.getUnitOwnerContactsMap(
      rawItems.filter((v) => v.visitType !== VisitorVisitType.WALKIN_OFFICE).map((v) => v.unitId),
    );
    const items = rawItems.map((v) => this.toGuardLiveVisitor(v, contactsMap));
    items.sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime());
    return { items, total: items.length };
  }

  private formatVisitorUnitLabel(visitor: VisitorWithRelations): string | null {
    if (visitor.visitType === VisitorVisitType.WALKIN_OFFICE) {
      return 'Management office';
    }
    if (!visitor.unit) return null;
    return formatUnitLabel({
      id: visitor.unit.id,
      identifier: visitor.unit.identifier,
      block: visitor.unit.block,
      ownerships: visitor.unit.ownerships,
    });
  }

  private normalizeOwnerContactsForGuard(
    contacts: Awaited<ReturnType<typeof getUnitOwnerContacts>>,
  ) {
    return contacts.map((contact) => ({
      ...contact,
      phone: this.resolveVisitorPhoneForGuard(contact.phone, '+60'),
    }));
  }

  private activeCheckInAt(visitor: VisitorWithRelations): Date {
    const active = visitor.checkIns
      .filter((ci) => !ci.checkOutAt)
      .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime())[0];
    return active?.checkInAt ?? visitor.updatedAt;
  }

  /** Acknowledgment-only fields for guard expected / no-show lists — no phone. */
  private toGuardExpectedVisitor(visitor: VisitorWithRelations) {
    return {
      id: visitor.id,
      name: visitor.name,
      expectedAt: visitor.expectedAt,
      vehiclePlate: visitor.vehiclePlate,
      visitType: visitor.visitType,
      passKind: visitor.passKind,
      deliveryPlatform: visitor.deliveryPlatform,
      status: visitor.status,
      unitLabel: this.formatVisitorUnitLabel(visitor),
      overnight: visitor.overnight ?? false,
    };
  }

  /** Strip PII beyond gate-duty minimum (no email, ID, QR, host records). */
  private toGuardLiveVisitor(
    visitor: VisitorWithRelations,
    contactsMap: Map<string, Awaited<ReturnType<typeof getUnitOwnerContacts>>>,
  ) {
    const rawOwnerContacts =
      visitor.unitId && visitor.visitType !== VisitorVisitType.WALKIN_OFFICE
        ? contactsMap.get(visitor.unitId)
        : undefined;
    const ownerContacts = rawOwnerContacts?.length
      ? this.normalizeOwnerContactsForGuard(rawOwnerContacts)
      : undefined;
    return {
      id: visitor.id,
      name: visitor.name,
      phone: this.resolveVisitorPhoneForGuard(visitor.phone, visitor.phoneCountryCode),
      purpose: visitor.purpose,
      vehiclePlate: visitor.vehiclePlate,
      checkedInAt: this.activeCheckInAt(visitor),
      unitLabel: this.formatVisitorUnitLabel(visitor),
      visitType: visitor.visitType,
      passKind: visitor.passKind,
      deliveryPlatform: visitor.deliveryPlatform,
      overnight: visitor.overnight ?? false,
      canCheckOut:
        visitor.visitType !== VisitorVisitType.WALKIN_UNIT &&
        visitor.visitType !== VisitorVisitType.WALKIN_OFFICE,
      ...(ownerContacts?.length ? { ownerContacts } : {}),
    };
  }

  async cancel(visitorId: string, user: AuthenticatedUser) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (!visitor.unitId || !this.userCanManageUnit(user, visitor.unitId)) {
      throw new BadRequestException('Only the unit owner can cancel this visitor');
    }
    if (!UPCOMING_VISITOR_STATUSES.includes(visitor.status)) {
      throw new BadRequestException('Only upcoming passes can be cancelled');
    }
    const updated = await this.prisma.visitor.update({
      where: { id: visitorId },
      data: { status: VisitorStatus.CANCELLED, cancelledAt: new Date() },
    });
    this.events.emit('visitor.cancelled', { visitorId, condoId: visitor.condoId });
    return updated;
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
    if (visitor.status === VisitorStatus.CANCELLED) {
      throw new BadRequestException('Visitor pass has been cancelled');
    }
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
    this.assertGateOperator(guard);
    const condoId = this.guardCondoId(guard);
    const visitor = await this.verifyByPass(pass, condoId);
    if (visitor.condoId !== condoId) {
      throw new ForbiddenException('Visitor pass is not for this condo');
    }
    if (visitor.status === VisitorStatus.CHECKED_IN) {
      throw new BadRequestException('Visitor already checked in');
    }
    if (
      visitor.visitType === VisitorVisitType.PRE_REG &&
      visitor.status === VisitorStatus.PENDING_MANAGEMENT_APPROVAL
    ) {
      throw new BadRequestException('Pre-registered visitor is awaiting management approval');
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
    this.assertGateOperator(guard);
    const condoId = this.guardCondoId(guard);
    const normalized = normalizePassInput(pass);
    if (isVisitorId(normalized)) {
      const byId = await this.prisma.visitor.findUnique({ where: { id: normalized } });
      if (
        byId &&
        byId.condoId === condoId &&
        (byId.visitType === VisitorVisitType.WALKIN_UNIT ||
          byId.visitType === VisitorVisitType.WALKIN_OFFICE)
      ) {
        throw new BadRequestException(
          'Walk-in visits close automatically — manual checkout is not used',
        );
      }
    }
    const visitor = await this.verifyByPass(pass, condoId);
    if (
      visitor.visitType === VisitorVisitType.WALKIN_UNIT ||
      visitor.visitType === VisitorVisitType.WALKIN_OFFICE
    ) {
      throw new BadRequestException(
        'Walk-in visits close automatically — manual checkout is not used',
      );
    }
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

  async listFavourites(user: AuthenticatedUser, unitId: string) {
    await this.assertUnitAccess(user, unitId);
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
    const phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;
    return this.prisma.favouriteVisitor.create({
      data: {
        userId: user.id,
        unitId: dto.unitId,
        name: dto.name,
        phone,
        phoneCountryCode: '+60',
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
    const data = { ...dto } as UpdateFavouriteVisitorDto;
    if (dto.phone !== undefined) {
      data.phone = this.normalizeMalaysiaPhoneField(dto.phone, true)!;
      data.phoneCountryCode = '+60';
    }
    return this.prisma.favouriteVisitor.update({
      where: { id },
      data,
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

  async getVisitorSettings(user: AuthenticatedUser, condoId: string) {
    if (!this.userIsManagement(user, condoId)) {
      throw new ForbiddenException('You cannot view visitor settings for this condo');
    }
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return parseCondoVisitorSettings(condo.settings);
  }

  async updateVisitorSettings(
    user: AuthenticatedUser,
    condoId: string,
    dto: UpdateVisitorSettingsDto,
  ) {
    if (!this.userIsManagement(user, condoId)) {
      throw new ForbiddenException('You cannot update visitor settings for this condo');
    }
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
    if (dto.walkInRequireOwnerApproval !== undefined) {
      patch.walkInRequireOwnerApproval = dto.walkInRequireOwnerApproval;
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

  async getOvernightOwnerSummary(user: AuthenticatedUser, condoId: string, month?: string) {
    if (!this.userIsManagement(user, condoId)) {
      throw new ForbiddenException('You cannot view overnight summaries for this condo');
    }
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

    const unitIds = units.map((u) => u.id);
    const [countMap, policyMap] = await Promise.all([
      countMonthlyOvernightByUnit(this.prisma, unitIds, range, settings),
      getUnitSuspendPolicyByUnit(this.prisma, unitIds),
    ]);

    const rows = units.map((unit) => {
      const count = countMap.get(unit.id) ?? 0;
      const policy = policyMap.get(unit.id) ?? null;
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
    });

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
