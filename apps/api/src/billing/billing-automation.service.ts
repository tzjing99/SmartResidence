import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AutomationJobKey,
  AutomationRunStatus,
  InvoiceStatus,
  type Prisma,
} from '@prisma/client';
import {
  type BillingAutomationPreview,
  type BillingAutomationRunResult,
  type BillingAutomationSettings,
  BillingAutomationSettingsSchema,
} from '@smartresidence/shared-types';
import { AutomationStatusService } from './automation-status.service';
import { BillingService } from './billing.service';
import { FeeScheduleService } from './fee-schedule.service';

type JsonObject = Record<string, unknown>;
type AutomationTrigger = 'scheduled' | 'manual_run';

interface PeriodWindow {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  runOnOrAfter: Date;
}

const MS_PER_DAY = 86_400_000;

const asJsonObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {};

@Injectable()
export class BillingAutomationService {
  private readonly logger = new Logger(BillingAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly feeSchedule: FeeScheduleService,
    private readonly automations: AutomationStatusService,
  ) {}

  calculateWindow(settings: BillingAutomationSettings, now: Date = new Date()): PeriodWindow {
    const scheduleYear = now.getUTCFullYear();
    const scheduleMonth = now.getUTCMonth();
    const runDay = this.clampDay(scheduleYear, scheduleMonth, settings.generationDay);
    const targetMonth = scheduleMonth + (settings.periodStrategy === 'NEXT_MONTH' ? 1 : 0);
    const periodStart = this.utcDate(scheduleYear, targetMonth, 1);
    const periodEnd = new Date(Date.UTC(scheduleYear, targetMonth + 1, 0, 23, 59, 59, 999));
    const dueDate =
      settings.dueStrategy === 'OFFSET_DAYS'
        ? this.endOfUtcDay(new Date(periodStart.getTime() + settings.dueOffsetDays * MS_PER_DAY))
        : this.utcDate(
            periodStart.getUTCFullYear(),
            periodStart.getUTCMonth(),
            this.clampDay(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), settings.dueDay),
            23,
            59,
            59,
            999,
          );

    return {
      periodStart,
      periodEnd,
      dueDate,
      runOnOrAfter: this.utcDate(scheduleYear, scheduleMonth, runDay),
    };
  }

  async previewCondo(condoId: string, now: Date = new Date()): Promise<BillingAutomationPreview> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { id: true, settings: true },
    });
    if (!condo) throw new NotFoundException('Condo not found');
    const settings = this.parseAutomationSettings(condo.settings);
    return this.buildPreview(condo.id, settings, now);
  }

  async runCondo(
    actor: AuthenticatedUser | null,
    condoId: string,
    opts: { dryRun?: boolean; now?: Date; requireDue?: boolean; trigger?: AutomationTrigger } = {},
  ): Promise<BillingAutomationRunResult> {
    const now = opts.now ?? new Date();
    const trigger = opts.trigger ?? 'manual_run';
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { id: true, settings: true },
    });
    if (!condo) throw new NotFoundException('Condo not found');
    const settings = this.parseAutomationSettings(condo.settings);
    const preview = await this.buildPreview(condo.id, settings, now);
    const shouldRun =
      settings.enabled &&
      preview.skipReason !== 'no_units' &&
      preview.skipReason !== 'no_billable_units' &&
      preview.skipReason !== 'already_generated' &&
      (!opts.requireDue || preview.dueToRun);
    const shouldTrack = !opts.dryRun && (!opts.requireDue || preview.dueToRun);
    const pipelineRun = shouldTrack
      ? actor
        ? await this.automations.startRun(actor, {
            condoId,
            jobKey: AutomationJobKey.BILLING_GENERATION,
            stageName: 'Creating monthly invoices',
            scheduledFor: new Date(preview.runOnOrAfter),
            summary: this.automationSummary(preview, trigger),
          })
        : await this.automations.startSystemRun({
            condoId,
            jobKey: AutomationJobKey.BILLING_GENERATION,
            stageName: 'Creating monthly invoices',
            scheduledFor: new Date(preview.runOnOrAfter),
            summary: this.automationSummary(preview, trigger),
          })
      : null;

    if (opts.dryRun || !shouldRun) {
      const result: BillingAutomationRunResult = {
        ...preview,
        dryRun: Boolean(opts.dryRun),
        created: 0,
        skipped: preview.alreadyBilled,
        skippedNoRate: preview.skippedNoRate,
        ranAt: now.toISOString(),
      };
      if (pipelineRun) {
        await this.automations.finishRun(pipelineRun.id, AutomationRunStatus.SKIPPED, {
          ...this.automationSummary(result, trigger),
          skipReason: preview.skipReason ?? null,
        });
      }
      return result;
    }

    try {
      const runId =
        pipelineRun?.id ??
        `billing_auto_${condoId}_${preview.periodStart.slice(0, 10)}_${now.getTime()}`;
      const generated = await this.billing.generateRecurring(
        actor,
        condoId,
        {
          periodStart: new Date(preview.periodStart),
          periodEnd: new Date(preview.periodEnd),
          dueDate: new Date(preview.dueDate),
        },
        {
          skipAuthorization: actor == null,
          triggeredByUserId: actor?.id ?? null,
          metadata: {
            autoGenerated: true,
            automation: true,
            automationRunId: runId,
            automationTrigger: trigger,
            automationGeneratedAt: now.toISOString(),
            periodStrategy: settings.periodStrategy,
            dueStrategy: settings.dueStrategy,
          },
        },
      );

      const result: BillingAutomationRunResult = {
        ...preview,
        dryRun: false,
        created: generated.created,
        skipped: generated.skipped,
        skippedNoRate: generated.skippedNoRate,
        ranAt: now.toISOString(),
      };
      await this.recordRun(condoId, settings, result, actor?.id ?? null, trigger);
      if (pipelineRun) {
        await this.automations.finishRun(
          pipelineRun.id,
          result.created > 0 ? AutomationRunStatus.SUCCESS : AutomationRunStatus.SKIPPED,
          this.automationSummary(result, trigger),
        );
      }
      return result;
    } catch (err) {
      if (pipelineRun) {
        await this.automations.failRun(
          pipelineRun.id,
          err,
          this.automationSummary(preview, trigger),
        );
      }
      throw err;
    }
  }

  async runDueAutomations(now: Date = new Date()): Promise<{
    checked: number;
    ran: number;
    created: number;
    skipped: number;
    skippedNoRate: number;
  }> {
    const condos = await this.prisma.condo.findMany({
      where: { deletedAt: null },
      select: { id: true, settings: true },
    });
    const summary = { checked: condos.length, ran: 0, created: 0, skipped: 0, skippedNoRate: 0 };
    for (const condo of condos) {
      const settings = this.parseAutomationSettings(condo.settings);
      if (!settings.enabled) continue;
      try {
        const result = await this.runCondo(null, condo.id, {
          now,
          requireDue: true,
          trigger: 'scheduled',
        });
        if (result.created > 0 || result.skipped > 0 || result.skippedNoRate > 0) {
          summary.ran += 1;
          summary.created += result.created;
          summary.skipped += result.skipped;
          summary.skippedNoRate += result.skippedNoRate;
        }
      } catch (err) {
        this.logger.warn(
          `Billing automation failed for condo ${condo.id}: ${(err as Error).message}`,
        );
      }
    }
    return summary;
  }

  private async buildPreview(
    condoId: string,
    settings: BillingAutomationSettings,
    now: Date,
  ): Promise<BillingAutomationPreview> {
    const window = this.calculateWindow(settings, now);
    const units = await this.prisma.unit.findMany({
      where: { condoId },
      include: { unitType: { include: { feeRate: true } } },
    });
    const billableUnitIds = units
      .filter((unit) => this.feeSchedule.computeLinesForUnit(unit as never).length > 0)
      .map((unit) => unit.id);
    const existing =
      billableUnitIds.length === 0
        ? []
        : await this.prisma.invoice.findMany({
            where: {
              condoId,
              unitId: { in: billableUnitIds },
              periodStart: window.periodStart,
              status: { not: InvoiceStatus.VOID },
            },
            select: { unitId: true },
          });
    const alreadyBilled = new Set(existing.map((invoice) => invoice.unitId)).size;
    const dueToRun = settings.enabled && now.getTime() >= window.runOnOrAfter.getTime();
    const skippedNoRate = units.length - billableUnitIds.length;
    const wouldCreate = Math.max(0, billableUnitIds.length - alreadyBilled);

    let skipReason: BillingAutomationPreview['skipReason'];
    if (!settings.enabled) skipReason = 'disabled';
    else if (!dueToRun) skipReason = 'not_due';
    else if (units.length === 0) skipReason = 'no_units';
    else if (billableUnitIds.length === 0) skipReason = 'no_billable_units';
    else if (wouldCreate === 0) skipReason = 'already_generated';

    return {
      condoId,
      enabled: settings.enabled,
      dueToRun,
      periodStart: window.periodStart.toISOString(),
      periodEnd: window.periodEnd.toISOString(),
      dueDate: window.dueDate.toISOString(),
      generationDay: settings.generationDay,
      runOnOrAfter: window.runOnOrAfter.toISOString(),
      units: units.length,
      billableUnits: billableUnitIds.length,
      alreadyBilled,
      wouldCreate,
      skippedNoRate,
      skipReason,
    };
  }

  private async recordRun(
    condoId: string,
    settings: BillingAutomationSettings,
    result: BillingAutomationRunResult,
    actorUserId: string | null,
    trigger: AutomationTrigger,
  ) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) return;
    const existing = asJsonObject(condo.settings);
    const nextSettings = {
      ...settings,
      lastRunAt: result.ranAt,
      lastRunPeriodStart: result.periodStart,
      lastRunPeriodEnd: result.periodEnd,
      lastRunCreated: result.created,
      lastRunSkipped: result.skipped,
      lastRunSkippedNoRate: result.skippedNoRate,
    };
    await this.prisma.$transaction([
      this.prisma.condo.update({
        where: { id: condoId },
        data: {
          settings: {
            ...existing,
            billingAutomation: nextSettings,
          } as Prisma.InputJsonValue,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          condoId,
          actorUserId,
          action: AuditAction.CREATE,
          resourceType: 'BillingAutomation',
          resourceId: result.periodStart,
          metadata: {
            trigger,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            dueDate: result.dueDate,
            created: result.created,
            skipped: result.skipped,
            skippedNoRate: result.skippedNoRate,
          },
        },
      }),
    ]);
  }

  private parseAutomationSettings(settings: unknown): BillingAutomationSettings {
    return BillingAutomationSettingsSchema.parse(asJsonObject(settings).billingAutomation ?? {});
  }

  private automationSummary(
    result: Pick<
      BillingAutomationPreview,
      'periodStart' | 'periodEnd' | 'dueDate' | 'wouldCreate' | 'alreadyBilled' | 'skippedNoRate'
    > &
      Partial<Pick<BillingAutomationRunResult, 'created' | 'skipped'>>,
    trigger: AutomationTrigger,
  ) {
    return {
      trigger,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      dueDate: result.dueDate,
      wouldCreate: result.wouldCreate,
      alreadyBilled: result.alreadyBilled,
      created: result.created ?? 0,
      skipped: result.skipped ?? result.alreadyBilled,
      skippedNoRate: result.skippedNoRate,
    };
  }

  private clampDay(year: number, month: number, day: number): number {
    return Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  }

  private utcDate(
    year: number,
    month: number,
    day: number,
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0,
  ): Date {
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
  }

  private endOfUtcDay(date: Date): Date {
    return this.utcDate(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    );
  }
}
