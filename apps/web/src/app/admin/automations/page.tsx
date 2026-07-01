'use client';

import { api } from '@/lib/api';
import { useAutomationStatus, useMyCondos } from '@smartresidence/api-client';
import type { AutomationRunStatus, AutomationStageStatus } from '@smartresidence/shared-types';
import { AUTOMATION_STATUS_LABELS, formatAutomationSummary } from '@smartresidence/shared-types';
import { Badge, Card, EmptyState, Skeleton, cn } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  PlayCircle,
} from 'lucide-react';

const STATUS_TONE: Record<
  AutomationRunStatus,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  PENDING: 'info',
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

const STATUS_ICON: Record<AutomationRunStatus, typeof CircleDashed> = {
  PENDING: CircleDashed,
  RUNNING: PlayCircle,
  SUCCESS: CheckCircle2,
  FAILED: AlertTriangle,
  SKIPPED: CircleDashed,
};

function fmtDateTime(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function summaryText(summary: AutomationStageStatus['summary']) {
  return formatAutomationSummary(summary);
}

function StageCard({ stage, last }: { stage: AutomationStageStatus; last: boolean }) {
  const Icon = STATUS_ICON[stage.status];
  return (
    <li className="relative flex gap-4">
      {!last ? (
        <span className="absolute left-[18px] top-10 h-[calc(100%-1rem)] w-px bg-[rgb(var(--sr-border))]" />
      ) : null}
      <div
        className={cn(
          'relative z-10 grid size-9 shrink-0 place-items-center rounded-full border bg-[rgb(var(--sr-card))]',
          stage.status === 'SUCCESS' && 'border-emerald-300 text-emerald-600',
          stage.status === 'FAILED' && 'border-red-300 text-red-600',
          stage.status === 'RUNNING' && 'border-amber-300 text-amber-600',
          stage.status === 'PENDING' && 'border-sky-300 text-sky-600',
        )}
      >
        <Icon className="size-4" />
      </div>
      <Card className="flex-1 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{stage.name}</h3>
              <Badge tone={STATUS_TONE[stage.status]}>
                {AUTOMATION_STATUS_LABELS[stage.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm sr-muted">{stage.description}</p>
          </div>
          <div className="text-left sm:text-right text-xs sr-muted">
            <div className="font-medium text-[rgb(var(--sr-fg))]">
              {stage.upcomingLabel ?? 'Event based'}
            </div>
            <div>{fmtDateTime(stage.nextScheduledAt)}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3">
            <div className="text-xs sr-muted">Current step</div>
            <div className="mt-1 text-sm font-medium">{stage.currentStage}</div>
          </div>
          <div className="rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3">
            <div className="text-xs sr-muted">Latest run</div>
            <div className="mt-1 text-sm font-medium">
              {stage.latestRun
                ? fmtDateTime(stage.latestRun.finishedAt ?? stage.latestRun.startedAt)
                : 'No run yet'}
            </div>
          </div>
          <div className="rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3">
            <div className="text-xs sr-muted">Last result</div>
            <div className="mt-1 text-sm font-medium">{summaryText(stage.summary)}</div>
          </div>
        </div>

        {stage.errorMessage ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {stage.errorMessage}
          </div>
        ) : null}
      </Card>
    </li>
  );
}

export default function AdminAutomationsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const status = useAutomationStatus(api, condoId);
  const data = status.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="sr-muted">
            See what is running now and what is scheduled next for invoices, payments, and
            reminders.
          </p>
        </div>
        <Badge tone={status.isFetching ? 'warning' : 'neutral'} className="self-start">
          <CalendarClock className="size-3.5" />
          {status.isFetching ? 'Refreshing' : 'Auto refresh 30s'}
        </Badge>
      </header>

      {!condoId ? (
        <EmptyState
          title="No condo selected"
          description="Automation status appears after your management condo loads."
        />
      ) : status.isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : data ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <GitBranch className="size-4 text-[rgb(var(--sr-coral))]" />
                  {data.condoName} — scheduled jobs
                </div>
                <p className="mt-1 text-sm sr-muted">
                  Last refreshed {fmtDateTime(data.generatedAt)}. Green means the last run finished
                  successfully, amber means running now, blue means scheduled.
                </p>
              </div>
              <div className="text-sm sr-muted">{data.recentRuns.length} recent run(s)</div>
            </div>
          </Card>

          <ol className="flex flex-col gap-4">
            {data.stages.map((stage: AutomationStageStatus, idx) => (
              <StageCard key={stage.jobKey} stage={stage} last={idx === data.stages.length - 1} />
            ))}
          </ol>

          <Card>
            <h2 className="font-semibold mb-3">Recent history</h2>
            {data.recentRuns.length === 0 ? (
              <p className="text-sm sr-muted">
                No automation runs recorded yet. Monthly invoice generation and overdue checks will
                appear here after they run.
              </p>
            ) : (
              <div className="divide-y divide-[rgb(var(--sr-border))]">
                {data.recentRuns.slice(0, 8).map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{run.stageName}</div>
                      <div className="text-xs sr-muted">
                        Started {fmtDateTime(run.startedAt)} · Finished{' '}
                        {fmtDateTime(run.finishedAt)}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[run.status]}>
                      {AUTOMATION_STATUS_LABELS[run.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <EmptyState
          title="Automation status unavailable"
          description="Try refreshing after the API is reachable."
        />
      )}
    </div>
  );
}
