import { assertCondoManagement } from '@/common/authz/assert-condo-management';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AccessRestrictionSource,
  AuditAction,
  InvoiceStatus,
  Prisma,
  RoleId,
} from '@prisma/client';
import {
  ACCESS_RESTRICTION_ERROR_CODE,
  type AccessRestrictionCapability,
  type AccessRestrictionExportPayload,
  type AccessRestrictionExportRow,
  type AccessRestrictionZone,
  type CondoAccessRestrictionSettings,
  type ResidentUnitAccessStatus,
  type UnitAccessRestrictionView,
  type UpdateCondoAccessRestrictionSettingsInput,
} from '@smartresidence/shared-types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  mergeAccessRestrictionSettings,
  parseAccessRestrictionSettings,
  toPublicAccessRestrictionSettings,
  type StoredAccessRestrictionSettings,
} from './access-restriction-settings';

const ARREARS_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.OVERDUE,
];

export class AccessRestrictedArrearsError extends ForbiddenException {
  constructor(message = 'Access restricted due to unpaid maintenance charges') {
    super({
      statusCode: 403,
      error: 'Forbidden',
      message: `${ACCESS_RESTRICTION_ERROR_CODE}: ${message}`,
      code: ACCESS_RESTRICTION_ERROR_CODE,
    });
  }
}

type UnitArrearsSnapshot = {
  unitId: string;
  outstanding: number;
  oldestDueDate: Date | null;
  daysPastDue: number;
};

@Injectable()
export class AccessRestrictionService {
  private readonly logger = new Logger(AccessRestrictionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(user: AuthenticatedUser, condoId: string): Promise<CondoAccessRestrictionSettings> {
    assertCondoManagement(user, condoId);
    const condo = await this.requireCondo(condoId);
    return toPublicAccessRestrictionSettings(parseAccessRestrictionSettings(condo.settings));
  }

  async updateSettings(
    user: AuthenticatedUser,
    condoId: string,
    dto: UpdateCondoAccessRestrictionSettingsInput,
  ): Promise<CondoAccessRestrictionSettings> {
    assertCondoManagement(user, condoId);
    const condo = await this.requireCondo(condoId);
    const current = parseAccessRestrictionSettings(condo.settings);

    let webhookSecret = current.webhookSecret;
    if (dto.webhookSecret !== undefined) {
      webhookSecret = dto.webhookSecret.trim() === '' ? null : dto.webhookSecret.trim().slice(0, 256);
    }

    const next: StoredAccessRestrictionSettings = {
      enabled: dto.enabled ?? current.enabled,
      graceDays: dto.graceDays ?? current.graceDays,
      minOutstanding: dto.minOutstanding ?? current.minOutstanding,
      softBlockFacility: dto.softBlockFacility ?? current.softBlockFacility,
      softBlockVisitors: dto.softBlockVisitors ?? current.softBlockVisitors,
      softBlockDeliveryPasses: dto.softBlockDeliveryPasses ?? current.softBlockDeliveryPasses,
      softBlockRecurringPasses: dto.softBlockRecurringPasses ?? current.softBlockRecurringPasses,
      zones: dto.zones ? [...dto.zones] : current.zones,
      webhookUrl:
        dto.webhookUrl !== undefined
          ? dto.webhookUrl === null || dto.webhookUrl === ''
            ? null
            : dto.webhookUrl
          : current.webhookUrl,
      webhookSecret,
      autoSyncEnabled: dto.autoSyncEnabled ?? current.autoSyncEnabled,
    };

    const settings = mergeAccessRestrictionSettings(condo.settings, next);
    await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: settings as Prisma.InputJsonValue },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId,
        actorUserId: user.id,
        actorRole: user.activeRole ?? undefined,
        action: AuditAction.UPDATE,
        resourceType: 'AccessRestriction',
        resourceId: condoId,
        metadata: { kind: 'settings', enabled: next.enabled, graceDays: next.graceDays },
      },
    });

    if (next.enabled) {
      await this.recomputeCondo(condoId, user.id);
    }

    return toPublicAccessRestrictionSettings(next);
  }

  async listUnits(user: AuthenticatedUser, condoId: string) {
    assertCondoManagement(user, condoId);
    const settings = parseAccessRestrictionSettings(
      (await this.requireCondo(condoId)).settings,
    );
    const rows = await this.prisma.unitAccessRestriction.findMany({
      where: { condoId },
      include: {
        unit: { select: { identifier: true, block: { select: { name: true } } } },
      },
      orderBy: [{ active: 'desc' }, { outstandingAmount: 'desc' }],
    });

    const arrears = await this.computeCondoArrears(condoId);
    const eligible = arrears.filter(
      (a) =>
        a.outstanding >= settings.minOutstanding && a.daysPastDue > settings.graceDays,
    );

    return {
      items: rows.map((r) => this.toView(r)),
      total: rows.length,
      eligibleArrearsCount: eligible.length,
    };
  }

  async forceRestrict(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
    reason?: string,
  ): Promise<UnitAccessRestrictionView> {
    assertCondoManagement(user, condoId);
    const unit = await this.requireUnit(condoId, unitId);
    const settings = parseAccessRestrictionSettings(
      (await this.requireCondo(condoId)).settings,
    );
    const arrears = await this.computeUnitArrears(unitId);
    const now = new Date();

    const row = await this.prisma.unitAccessRestriction.upsert({
      where: { unitId },
      create: {
        condoId,
        unitId,
        active: true,
        source: AccessRestrictionSource.MANUAL,
        manualExempt: false,
        zones: settings.zones,
        reason: reason?.trim() || 'Manual restriction by management',
        outstandingAmount: arrears.outstanding,
        oldestDueDate: arrears.oldestDueDate,
        activatedAt: now,
        clearedAt: null,
        updatedByUserId: user.id,
      },
      update: {
        active: true,
        source: AccessRestrictionSource.MANUAL,
        manualExempt: false,
        zones: settings.zones,
        reason: reason?.trim() || 'Manual restriction by management',
        outstandingAmount: arrears.outstanding,
        oldestDueDate: arrears.oldestDueDate,
        activatedAt: now,
        clearedAt: null,
        updatedByUserId: user.id,
      },
      include: {
        unit: { select: { identifier: true, block: { select: { name: true } } } },
      },
    });

    await this.audit(user, condoId, unitId, 'restrict', { reason: row.reason });
    await this.dispatchWebhook(condoId, 'unit.restricted', row);
    void unit;
    return this.toView(row);
  }

  async forceClear(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
  ): Promise<UnitAccessRestrictionView> {
    assertCondoManagement(user, condoId);
    await this.requireUnit(condoId, unitId);
    const now = new Date();
    const existing = await this.prisma.unitAccessRestriction.findUnique({ where: { unitId } });
    const settings = parseAccessRestrictionSettings(
      (await this.requireCondo(condoId)).settings,
    );
    const arrears = await this.computeUnitArrears(unitId);

    const row = await this.prisma.unitAccessRestriction.upsert({
      where: { unitId },
      create: {
        condoId,
        unitId,
        active: false,
        source: AccessRestrictionSource.MANUAL,
        manualExempt: true,
        zones: settings.zones,
        reason: 'Cleared by management',
        outstandingAmount: arrears.outstanding,
        oldestDueDate: arrears.oldestDueDate,
        activatedAt: null,
        clearedAt: now,
        updatedByUserId: user.id,
      },
      update: {
        active: false,
        source: AccessRestrictionSource.MANUAL,
        manualExempt: true,
        reason: 'Cleared by management',
        outstandingAmount: arrears.outstanding,
        oldestDueDate: arrears.oldestDueDate,
        clearedAt: now,
        updatedByUserId: user.id,
      },
      include: {
        unit: { select: { identifier: true, block: { select: { name: true } } } },
      },
    });

    await this.audit(user, condoId, unitId, 'clear', {
      wasActive: existing?.active ?? false,
    });
    await this.dispatchWebhook(condoId, 'unit.cleared', row);
    return this.toView(row);
  }

  async recomputeForUser(user: AuthenticatedUser, condoId: string) {
    assertCondoManagement(user, condoId);
    return this.recomputeCondo(condoId, user.id);
  }

  async recomputeCondo(condoId: string, actorUserId?: string | null) {
    const condo = await this.requireCondo(condoId);
    const settings = parseAccessRestrictionSettings(condo.settings);
    if (!settings.enabled) {
      return { activated: 0, cleared: 0, skipped: 0 };
    }

    const arrearsMap = new Map(
      (await this.computeCondoArrears(condoId)).map((a) => [a.unitId, a]),
    );
    const existing = await this.prisma.unitAccessRestriction.findMany({ where: { condoId } });
    const existingByUnit = new Map(existing.map((e) => [e.unitId, e]));

    let activated = 0;
    let cleared = 0;
    let skipped = 0;
    const now = new Date();
    const touchedUnitIds = new Set<string>([
      ...arrearsMap.keys(),
      ...existing.map((e) => e.unitId),
    ]);

    for (const unitId of touchedUnitIds) {
      const snap = arrearsMap.get(unitId) ?? {
        unitId,
        outstanding: 0,
        oldestDueDate: null,
        daysPastDue: 0,
      };
      const qualifies =
        snap.outstanding >= settings.minOutstanding && snap.daysPastDue > settings.graceDays;
      const row = existingByUnit.get(unitId);

      if (!qualifies) {
        if (row && (row.active || row.manualExempt)) {
          const updated = await this.prisma.unitAccessRestriction.update({
            where: { unitId },
            data: {
              active: false,
              manualExempt: false,
              outstandingAmount: snap.outstanding,
              oldestDueDate: snap.oldestDueDate,
              clearedAt: row.active ? now : row.clearedAt,
              updatedByUserId: actorUserId ?? row.updatedByUserId,
              reason: row.active ? 'Arrears cleared' : row.reason,
            },
            include: {
              unit: { select: { identifier: true, block: { select: { name: true } } } },
            },
          });
          if (row.active) {
            cleared += 1;
            await this.dispatchWebhook(condoId, 'unit.cleared', updated);
          }
        } else if (row) {
          await this.prisma.unitAccessRestriction.update({
            where: { unitId },
            data: {
              outstandingAmount: snap.outstanding,
              oldestDueDate: snap.oldestDueDate,
            },
          });
        }
        continue;
      }

      if (row?.manualExempt) {
        skipped += 1;
        await this.prisma.unitAccessRestriction.update({
          where: { unitId },
          data: {
            outstandingAmount: snap.outstanding,
            oldestDueDate: snap.oldestDueDate,
          },
        });
        continue;
      }

      if (row?.active && row.source === AccessRestrictionSource.MANUAL) {
        await this.prisma.unitAccessRestriction.update({
          where: { unitId },
          data: {
            outstandingAmount: snap.outstanding,
            oldestDueDate: snap.oldestDueDate,
            zones: settings.zones,
          },
        });
        skipped += 1;
        continue;
      }

      if (row?.active) {
        await this.prisma.unitAccessRestriction.update({
          where: { unitId },
          data: {
            outstandingAmount: snap.outstanding,
            oldestDueDate: snap.oldestDueDate,
            zones: settings.zones,
            reason: `Auto: ${snap.daysPastDue} days past due`,
          },
        });
        continue;
      }

      const updated = await this.prisma.unitAccessRestriction.upsert({
        where: { unitId },
        create: {
          condoId,
          unitId,
          active: true,
          source: AccessRestrictionSource.AUTO,
          manualExempt: false,
          zones: settings.zones,
          reason: `Auto: ${snap.daysPastDue} days past due`,
          outstandingAmount: snap.outstanding,
          oldestDueDate: snap.oldestDueDate,
          activatedAt: now,
          clearedAt: null,
          updatedByUserId: actorUserId ?? null,
        },
        update: {
          active: true,
          source: AccessRestrictionSource.AUTO,
          manualExempt: false,
          zones: settings.zones,
          reason: `Auto: ${snap.daysPastDue} days past due`,
          outstandingAmount: snap.outstanding,
          oldestDueDate: snap.oldestDueDate,
          activatedAt: now,
          clearedAt: null,
          updatedByUserId: actorUserId ?? null,
        },
        include: {
          unit: { select: { identifier: true, block: { select: { name: true } } } },
        },
      });
      activated += 1;
      await this.dispatchWebhook(condoId, 'unit.restricted', updated);
    }

    return { activated, cleared, skipped };
  }

  async exportJson(user: AuthenticatedUser, condoId: string): Promise<AccessRestrictionExportPayload> {
    assertCondoManagement(user, condoId);
    const settings = parseAccessRestrictionSettings(
      (await this.requireCondo(condoId)).settings,
    );
    const rows = await this.prisma.unitAccessRestriction.findMany({
      where: { condoId, active: true },
      include: {
        unit: { select: { identifier: true, block: { select: { name: true } } } },
      },
      orderBy: { activatedAt: 'asc' },
    });
    return {
      condoId,
      generatedAt: new Date().toISOString(),
      zonesDefault: settings.zones,
      units: rows.map((r) => this.toExportRow(r)),
    };
  }

  async exportCsv(user: AuthenticatedUser, condoId: string): Promise<string> {
    const payload = await this.exportJson(user, condoId);
    const header = [
      'unitId',
      'identifier',
      'block',
      'active',
      'source',
      'zones',
      'outstandingAmount',
      'oldestDueDate',
      'activatedAt',
      'reason',
    ];
    const lines = [header.join(',')];
    for (const u of payload.units) {
      lines.push(
        [
          u.unitId,
          csvEscape(u.identifier),
          csvEscape(u.block ?? ''),
          String(u.active),
          u.source,
          csvEscape(u.zones.join('|')),
          String(u.outstandingAmount),
          u.oldestDueDate ?? '',
          u.activatedAt ?? '',
          csvEscape(u.reason ?? ''),
        ].join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }

  /**
   * Resident-facing status for proactive “pay to unlock” UI.
   * Only the unit’s owner/tenant (or condo management) may read it.
   */
  async getResidentUnitStatus(
    user: AuthenticatedUser,
    unitId: string,
  ): Promise<ResidentUnitAccessStatus> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, condoId: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.assertResidentOrManagement(user, unit.id, unit.condoId);

    const condo = await this.prisma.condo.findUnique({
      where: { id: unit.condoId },
      select: { settings: true },
    });
    const settings = parseAccessRestrictionSettings(condo?.settings);
    const row = await this.prisma.unitAccessRestriction.findUnique({ where: { unitId } });
    const restricted = Boolean(settings.enabled && row?.active);

    return {
      unitId: unit.id,
      condoId: unit.condoId,
      restricted,
      outstandingAmount: row ? Number(row.outstandingAmount) : 0,
      reason: restricted ? (row?.reason ?? null) : null,
      zones: restricted ? this.parseZones(row?.zones) : [],
      blocked: {
        facility: restricted && settings.softBlockFacility,
        visitors: restricted && settings.softBlockVisitors,
        deliveryPasses: restricted && settings.softBlockDeliveryPasses,
        recurringPasses: restricted && settings.softBlockRecurringPasses,
      },
    };
  }

  /**
   * Soft-block gate for resident self-serve flows.
   * Management / guard operators bypass.
   */
  async assertUnitNotAccessRestricted(
    actor: AuthenticatedUser,
    unitId: string,
    capability: AccessRestrictionCapability,
  ): Promise<void> {
    if (this.isOpsBypass(actor)) return;

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, condoId: true },
    });
    if (!unit) return;

    const condo = await this.prisma.condo.findUnique({
      where: { id: unit.condoId },
      select: { settings: true },
    });
    if (!condo) return;
    const settings = parseAccessRestrictionSettings(condo.settings);
    if (!settings.enabled) return;
    if (!this.capabilityEnabled(settings, capability)) return;

    const row = await this.prisma.unitAccessRestriction.findUnique({ where: { unitId } });
    if (!row?.active) return;

    throw new AccessRestrictedArrearsError(
      'This unit cannot use this service while maintenance charges are unpaid. Please settle outstanding invoices or contact management.',
    );
  }

  @OnEvent('invoice.paid')
  async onInvoicePaid(payload: { invoiceId: string }) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payload.invoiceId },
        select: { condoId: true },
      });
      if (!invoice) return;
      await this.recomputeCondo(invoice.condoId, null);
    } catch (err) {
      this.logger.warn(
        `access-restriction recompute failed after invoice.paid: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private capabilityEnabled(
    settings: StoredAccessRestrictionSettings,
    capability: AccessRestrictionCapability,
  ): boolean {
    switch (capability) {
      case 'facility':
        return settings.softBlockFacility;
      case 'visitors':
        return settings.softBlockVisitors;
      case 'deliveryPasses':
        return settings.softBlockDeliveryPasses;
      case 'recurringPasses':
        return settings.softBlockRecurringPasses;
      default:
        return false;
    }
  }

  private isOpsBypass(actor: AuthenticatedUser): boolean {
    return actor.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        r.roleId === RoleId.MANAGEMENT_ADMIN ||
        r.roleId === RoleId.MANAGEMENT_STAFF ||
        r.roleId === RoleId.SECURITY_GUARD,
    );
  }

  private async computeCondoArrears(condoId: string): Promise<UnitArrearsSnapshot[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { condoId, status: { in: ARREARS_STATUSES } },
      select: { unitId: true, total: true, amountPaid: true, dueDate: true },
    });
    const byUnit = new Map<string, UnitArrearsSnapshot>();
    const now = Date.now();
    for (const inv of invoices) {
      const outstanding = Number(inv.total) - Number(inv.amountPaid);
      if (outstanding <= 0.005) continue;
      const daysPastDue = Math.floor((now - new Date(inv.dueDate).getTime()) / 86_400_000);
      const existing = byUnit.get(inv.unitId);
      if (!existing) {
        byUnit.set(inv.unitId, {
          unitId: inv.unitId,
          outstanding,
          oldestDueDate: inv.dueDate,
          daysPastDue,
        });
      } else {
        existing.outstanding += outstanding;
        if (!existing.oldestDueDate || inv.dueDate < existing.oldestDueDate) {
          existing.oldestDueDate = inv.dueDate;
          existing.daysPastDue = daysPastDue;
        } else {
          existing.daysPastDue = Math.max(existing.daysPastDue, daysPastDue);
        }
      }
    }
    return [...byUnit.values()];
  }

  private async computeUnitArrears(unitId: string): Promise<UnitArrearsSnapshot> {
    const invoices = await this.prisma.invoice.findMany({
      where: { unitId, status: { in: ARREARS_STATUSES } },
      select: { total: true, amountPaid: true, dueDate: true },
    });
    const now = Date.now();
    let outstanding = 0;
    let oldestDueDate: Date | null = null;
    let daysPastDue = 0;
    for (const inv of invoices) {
      const amt = Number(inv.total) - Number(inv.amountPaid);
      if (amt <= 0.005) continue;
      outstanding += amt;
      const days = Math.floor((now - new Date(inv.dueDate).getTime()) / 86_400_000);
      if (!oldestDueDate || inv.dueDate < oldestDueDate) {
        oldestDueDate = inv.dueDate;
        daysPastDue = days;
      } else {
        daysPastDue = Math.max(daysPastDue, days);
      }
    }
    return { unitId, outstanding, oldestDueDate, daysPastDue };
  }

  private parseZones(raw: unknown): AccessRestrictionZone[] {
    if (!Array.isArray(raw)) return ['CAR_PARK', 'AMENITIES'];
    return raw.filter(
      (z): z is AccessRestrictionZone =>
        z === 'CAR_PARK' || z === 'AMENITIES' || z === 'COMMON_FACILITIES',
    );
  }

  private toView(row: {
    id: string;
    condoId: string;
    unitId: string;
    active: boolean;
    source: AccessRestrictionSource;
    manualExempt: boolean;
    zones: unknown;
    reason: string | null;
    outstandingAmount: Prisma.Decimal | number;
    oldestDueDate: Date | null;
    activatedAt: Date | null;
    clearedAt: Date | null;
    updatedAt: Date;
    unit: { identifier: string; block: { name: string } | null };
  }): UnitAccessRestrictionView {
    return {
      id: row.id,
      condoId: row.condoId,
      unitId: row.unitId,
      unitIdentifier: row.unit.identifier,
      blockName: row.unit.block?.name ?? null,
      active: row.active,
      source: row.source,
      manualExempt: row.manualExempt,
      zones: this.parseZones(row.zones),
      reason: row.reason,
      outstandingAmount: Number(row.outstandingAmount),
      oldestDueDate: row.oldestDueDate?.toISOString() ?? null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      clearedAt: row.clearedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toExportRow(row: {
    unitId: string;
    active: boolean;
    source: AccessRestrictionSource;
    zones: unknown;
    reason: string | null;
    outstandingAmount: Prisma.Decimal | number;
    oldestDueDate: Date | null;
    activatedAt: Date | null;
    unit: { identifier: string; block: { name: string } | null };
  }): AccessRestrictionExportRow {
    return {
      unitId: row.unitId,
      identifier: row.unit.identifier,
      block: row.unit.block?.name ?? null,
      active: row.active,
      source: row.source,
      zones: this.parseZones(row.zones),
      outstandingAmount: Number(row.outstandingAmount),
      oldestDueDate: row.oldestDueDate?.toISOString() ?? null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      reason: row.reason,
    };
  }

  private async assertResidentOrManagement(
    user: AuthenticatedUser,
    unitId: string,
    condoId: string,
  ): Promise<void> {
    if (this.isOpsBypass(user) && user.roles.some((r) => r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN)) {
      return;
    }
    if (user.roles.some((r) => r.unitId === unitId)) return;
    const [ownership, tenancy] = await Promise.all([
      this.prisma.ownership.findFirst({ where: { userId: user.id, unitId, status: 'ACTIVE' } }),
      this.prisma.tenancy.findFirst({ where: { userId: user.id, unitId, status: 'ACTIVE' } }),
    ]);
    if (!ownership && !tenancy) {
      throw new ForbiddenException('You are not a resident of this unit');
    }
  }

  private async requireCondo(condoId: string) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo || condo.deletedAt) throw new NotFoundException('Condo not found');
    return condo;
  }

  private async requireUnit(condoId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, condoId } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  private async audit(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
    kind: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        actorUserId: user.id,
        actorRole: user.activeRole ?? undefined,
        action: AuditAction.UPDATE,
        resourceType: 'AccessRestriction',
        resourceId: unitId,
        metadata: { kind, ...metadata },
      },
    });
  }

  private async dispatchWebhook(
    condoId: string,
    event: 'unit.restricted' | 'unit.cleared',
    row: {
      unitId: string;
      active: boolean;
      source: AccessRestrictionSource;
      zones: unknown;
      reason: string | null;
      outstandingAmount: Prisma.Decimal | number;
      oldestDueDate: Date | null;
      activatedAt: Date | null;
      unit: { identifier: string; block: { name: string } | null };
    },
  ) {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    if (!condo) return;
    const settings = parseAccessRestrictionSettings(condo.settings);
    if (!settings.autoSyncEnabled || !settings.webhookUrl) return;

    const body = JSON.stringify({
      event,
      condoId,
      occurredAt: new Date().toISOString(),
      unit: this.toExportRow(row),
    });

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'SmartResidence-AccessRestriction/1.0',
      'x-sr-event': event,
    };
    if (settings.webhookSecret) {
      const sig = createHmac('sha256', settings.webhookSecret).update(body).digest('hex');
      headers['x-sr-signature'] = `sha256=${sig}`;
    }

    try {
      const res = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`access-restriction webhook ${event} → HTTP ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `access-restriction webhook ${event} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

/** Exported for tests — constant-time compare of webhook signatures. */
export function verifyAccessRestrictionSignature(
  body: string,
  secret: string,
  header: string | undefined,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const provided = header.slice('sha256='.length);
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
