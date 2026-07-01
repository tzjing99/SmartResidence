import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AutomationJobKey,
  AutomationRunStatus,
  PaymentStatus,
  Prisma,
  RoleId,
} from '@prisma/client';
import {
  AUTOMATION_JOB_LABELS,
  type AutomationRunView,
  type AutomationStageStatus,
  type AutomationStatusResponse,
  type AutomationSummary,
  BillingAutomationSettingsSchema,
  DEFAULT_BILLING_AUTOMATION_SETTINGS,
} from '@smartresidence/shared-types';

const RUNNING_STALE_MS = 6 * 60 * 60 * 1000;

const JOB_DESCRIPTIONS: Record<AutomationJobKey, string> = {
  BILLING_GENERATION:
    'Creates monthly maintenance fee and sinking fund invoices from your fee schedule.',
  DUE_SWEEP: 'Finds unpaid invoices past their due date and marks them overdue.',
  PAYMENT_RECONCILIATION: 'Checks online payment results that may need follow-up.',
  PAYMENT_REVIEW: 'Shows failed payments and amount mismatches for your review.',
  REMINDERS: 'Prepares reminders for invoices that are almost due or already overdue.',
};

const DEFAULT_STAGE: Record<AutomationJobKey, string> = {
  BILLING_GENERATION: 'Waiting for the next scheduled run',
  DUE_SWEEP: 'Waiting for the next overdue check',
  PAYMENT_RECONCILIATION: 'Watching for payment updates',
  PAYMENT_REVIEW: 'No payments waiting for review',
  REMINDERS: 'Waiting for the next reminder window',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function jsonSummary(summary: AutomationSummary): Prisma.InputJsonValue {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(summary)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
}

function safeSummary(value: unknown): AutomationSummary {
  const raw = asRecord(value);
  const clean: AutomationSummary = {};
  for (const [key, val] of Object.entries(raw)) {
    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      val === null
    ) {
      clean[key] = val;
    }
  }
  return clean;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function endOfMonthDay(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthlyAtOrAfter(now: Date, day: number, hour: number): Date {
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(day, endOfMonthDay(now.getFullYear(), now.getMonth())),
    hour,
  );
  if (candidate.getTime() > now.getTime()) return candidate;
  const nextMonth = now.getMonth() + 1;
  return new Date(
    now.getFullYear(),
    nextMonth,
    Math.min(day, endOfMonthDay(now.getFullYear(), nextMonth)),
    hour,
  );
}

function dailyAtOrAfter(now: Date, hour: number): Date {
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (candidate.getTime() > now.getTime()) return candidate;
  candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

@Injectable()
export class AutomationStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async listStatus(actor: AuthenticatedUser, condoId: string): Promise<AutomationStatusResponse> {
    this.assertCondoManagement(actor, condoId, false);
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { id: true, name: true, settings: true },
    });
    if (!condo) throw new NotFoundException('Condo not found');

    const [runs, failedPayments, reviewPayments] = await Promise.all([
      this.prisma.automationRun.findMany({
        where: { condoId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.payment.count({
        where: { invoice: { condoId }, status: PaymentStatus.FAILED },
      }),
      this.prisma.payment.findMany({
        where: { invoice: { condoId }, status: PaymentStatus.PENDING },
        select: { metadata: true },
        take: 500,
      }),
    ]);

    const recentRuns = runs.map((run) => this.toView(run));
    const latestByJob = new Map<AutomationJobKey, AutomationRunView>();
    for (const run of recentRuns) {
      if (!latestByJob.has(run.jobKey)) latestByJob.set(run.jobKey, run);
    }

    const settings = this.readBillingAutomationSettings(condo.settings);
    const now = new Date();
    const flaggedForReview = reviewPayments.filter((p) =>
      Boolean(asRecord(p.metadata).reviewReason),
    ).length;
    const nextByJob: Partial<Record<AutomationJobKey, Date | null>> = {
      BILLING_GENERATION: settings.enabled
        ? monthlyAtOrAfter(now, settings.generationDay, 2)
        : null,
      DUE_SWEEP: dailyAtOrAfter(now, 3),
      PAYMENT_RECONCILIATION: dailyAtOrAfter(now, 4),
      PAYMENT_REVIEW: null,
      REMINDERS: dailyAtOrAfter(now, 9),
    };
    const extraSummary: Partial<Record<AutomationJobKey, AutomationSummary>> = {
      BILLING_GENERATION: {
        enabled: settings.enabled,
        generationDay: settings.generationDay,
        dueStrategy: settings.dueStrategy,
      },
      PAYMENT_REVIEW: {
        failedPayments,
        flaggedForReview,
      },
    };

    return {
      condoId,
      condoName: condo.name,
      generatedAt: now.toISOString(),
      stages: (Object.values(AutomationJobKey) as AutomationJobKey[]).map((jobKey) =>
        this.stageFor(
          jobKey,
          latestByJob.get(jobKey) ?? null,
          nextByJob[jobKey] ?? null,
          extraSummary[jobKey] ?? {},
        ),
      ),
      recentRuns,
    };
  }

  async startRun(
    actor: AuthenticatedUser,
    input: {
      condoId: string;
      jobKey: AutomationJobKey;
      stageName: string;
      scheduledFor?: Date | null;
      summary?: AutomationSummary;
    },
  ): Promise<AutomationRunView> {
    this.assertCondoManagement(actor, input.condoId, true);
    const run = await this.prisma.automationRun.create({
      data: {
        condoId: input.condoId,
        jobKey: input.jobKey,
        stageName: input.stageName,
        status: AutomationRunStatus.RUNNING,
        scheduledFor: input.scheduledFor ?? null,
        startedAt: new Date(),
        triggeredByUserId: actor.id,
        summary: jsonSummary(input.summary ?? {}),
      },
    });
    return this.toView(run);
  }

  async startSystemRun(input: {
    condoId: string;
    jobKey: AutomationJobKey;
    stageName: string;
    scheduledFor?: Date | null;
    summary?: AutomationSummary;
  }): Promise<AutomationRunView> {
    const run = await this.prisma.automationRun.create({
      data: {
        condoId: input.condoId,
        jobKey: input.jobKey,
        stageName: input.stageName,
        status: AutomationRunStatus.RUNNING,
        scheduledFor: input.scheduledFor ?? null,
        startedAt: new Date(),
        triggeredByUserId: null,
        summary: jsonSummary(input.summary ?? {}),
      },
    });
    return this.toView(run);
  }

  async finishRun(
    id: string,
    status: AutomationRunStatus,
    summary: AutomationSummary,
  ): Promise<AutomationRunView> {
    const run = await this.prisma.automationRun.update({
      where: { id },
      data: {
        status,
        finishedAt: new Date(),
        summary: jsonSummary(summary),
      },
    });
    return this.toView(run);
  }

  async failRun(
    id: string,
    err: unknown,
    summary: AutomationSummary = {},
  ): Promise<AutomationRunView> {
    const run = await this.prisma.automationRun.update({
      where: { id },
      data: {
        status: AutomationRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : 'Automation failed',
        summary: jsonSummary(summary),
      },
    });
    return this.toView(run);
  }

  private stageFor(
    jobKey: AutomationJobKey,
    latestRun: AutomationRunView | null,
    nextScheduledAt: Date | null,
    extraSummary: AutomationSummary,
  ): AutomationStageStatus {
    const isStaleRunning =
      latestRun?.status === AutomationRunStatus.RUNNING &&
      latestRun.startedAt != null &&
      Date.now() - new Date(latestRun.startedAt).getTime() > RUNNING_STALE_MS;
    const status = isStaleRunning
      ? AutomationRunStatus.FAILED
      : (latestRun?.status ??
        (nextScheduledAt ? AutomationRunStatus.PENDING : AutomationRunStatus.SKIPPED));
    return {
      jobKey,
      name: AUTOMATION_JOB_LABELS[jobKey],
      description: JOB_DESCRIPTIONS[jobKey],
      status,
      currentStage: isStaleRunning
        ? 'Run appears stuck'
        : (latestRun?.stageName ?? DEFAULT_STAGE[jobKey]),
      nextScheduledAt: iso(nextScheduledAt),
      upcomingLabel: nextScheduledAt
        ? `Next run: ${AUTOMATION_JOB_LABELS[jobKey].toLowerCase()}`
        : jobKey === 'PAYMENT_REVIEW'
          ? 'Runs when payments need review'
          : null,
      latestRun,
      summary: { ...extraSummary, ...(latestRun?.summary ?? {}) },
      errorMessage: isStaleRunning
        ? 'This run has been in progress for more than 6 hours. Check the server or try again.'
        : (latestRun?.errorMessage ?? null),
    };
  }

  private readBillingAutomationSettings(settings: unknown) {
    const rawSettings = asRecord(settings);
    const rawAutomation =
      rawSettings.billingAutomation ??
      rawSettings.billingAutomationSettings ??
      rawSettings.automation;
    const parsed = BillingAutomationSettingsSchema.safeParse(rawAutomation ?? {});
    return parsed.success ? parsed.data : DEFAULT_BILLING_AUTOMATION_SETTINGS;
  }

  private toView(run: {
    id: string;
    condoId: string;
    jobKey: AutomationJobKey;
    stageName: string;
    status: AutomationRunStatus;
    scheduledFor: Date | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    summary: Prisma.JsonValue;
    errorMessage: string | null;
    triggeredByUserId: string | null;
    createdAt: Date;
  }): AutomationRunView {
    return {
      id: run.id,
      condoId: run.condoId,
      jobKey: run.jobKey,
      stageName: run.stageName,
      status: run.status,
      scheduledFor: iso(run.scheduledFor),
      startedAt: iso(run.startedAt),
      finishedAt: iso(run.finishedAt),
      summary: safeSummary(run.summary),
      errorMessage: run.errorMessage,
      triggeredByUserId: run.triggeredByUserId,
      createdAt: run.createdAt.toISOString(),
    };
  }

  private assertCondoManagement(
    user: AuthenticatedUser,
    condoId: string,
    adminOnly: boolean,
  ): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId) ||
        (!adminOnly && r.roleId === RoleId.MANAGEMENT_STAFF && r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('You cannot access automation status for this condo');
  }
}
