'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAutomationStatus,
  useBillingAutomation,
  useBillingAutomationPreview,
  useRunBillingAutomation,
  useUpdateBillingAutomation,
} from '@smartresidence/api-client';
import type {
  AutomationRunStatus,
  BillingAutomationPreview,
  BillingAutomationRunResult,
  BillingAutomationSettings,
} from '@smartresidence/shared-types';
import {
  AUTOMATION_STATUS_LABELS,
  DEFAULT_BILLING_AUTOMATION_SETTINGS,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { GitBranch } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type AutomationDraft = Pick<
  BillingAutomationSettings,
  'enabled' | 'generationDay' | 'periodStrategy' | 'dueStrategy' | 'dueDay' | 'dueOffsetDays'
>;

const STATUS_TONE: Record<AutomationRunStatus, BadgeTone> = {
  PENDING: 'info',
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

function getPreviewStatus(p: BillingAutomationPreview): {
  badge: string;
  title: string;
  description: string;
  tone: BadgeTone;
} {
  if (!p.enabled) {
    return {
      badge: 'Off',
      title: 'Automatic generation is off',
      description:
        'This preview only shows what would happen if automatic generation were enabled or run manually now.',
      tone: 'neutral',
    };
  }

  if (!p.dueToRun) {
    return {
      badge: 'Scheduled',
      title: `Scheduled for ${fmtDate(p.runOnOrAfter)}`,
      description: 'Automatic generation is not scheduled to run today.',
      tone: 'info',
    };
  }

  if (p.skipReason === 'no_units') {
    return {
      badge: 'Needs setup',
      title: 'No units found',
      description: 'Add units before automatic generation can create invoices.',
      tone: 'warning',
    };
  }

  if (p.skipReason === 'no_billable_units') {
    return {
      badge: 'Needs rates',
      title: 'No billable fee rates found',
      description: 'Add fee rates before automatic generation can create invoices.',
      tone: 'warning',
    };
  }

  if (p.skipReason === 'already_generated') {
    return {
      badge: 'Already billed',
      title: 'Invoices already exist for this period',
      description: 'Automatic generation will skip duplicate invoices for the same billing period.',
      tone: 'neutral',
    };
  }

  return {
    badge: 'Ready',
    title: 'Ready to run today',
    description: 'Automatic generation is scheduled for today and can create invoices now.',
    tone: 'success',
  };
}

function previewSentence(p: BillingAutomationPreview) {
  const invoiceWord = plural(p.wouldCreate, 'invoice');
  const alreadyBilledUnitWord = plural(p.alreadyBilled, 'unit');
  const noRateUnitWord = plural(p.skippedNoRate, 'unit');

  return `If run now, this would create ${p.wouldCreate} ${invoiceWord}; ${p.alreadyBilled} ${alreadyBilledUnitWord} ${
    p.alreadyBilled === 1 ? 'is' : 'are'
  } already billed; ${p.skippedNoRate} ${noRateUnitWord} ${
    p.skippedNoRate === 1 ? 'has' : 'have'
  } no fee rate.`;
}

export function BillingAutomationPanel({ condoId }: { condoId: string }) {
  const automation = useBillingAutomation(api, condoId);
  const preview = useBillingAutomationPreview(api, condoId);
  const status = useAutomationStatus(api, condoId);
  const update = useUpdateBillingAutomation(api);
  const run = useRunBillingAutomation(api);
  const [draft, setDraft] = React.useState<AutomationDraft>({
    enabled: DEFAULT_BILLING_AUTOMATION_SETTINGS.enabled,
    generationDay: DEFAULT_BILLING_AUTOMATION_SETTINGS.generationDay,
    periodStrategy: DEFAULT_BILLING_AUTOMATION_SETTINGS.periodStrategy,
    dueStrategy: DEFAULT_BILLING_AUTOMATION_SETTINGS.dueStrategy,
    dueDay: DEFAULT_BILLING_AUTOMATION_SETTINGS.dueDay,
    dueOffsetDays: DEFAULT_BILLING_AUTOMATION_SETTINGS.dueOffsetDays,
  });
  const [lastRun, setLastRun] = React.useState<BillingAutomationRunResult | null>(null);

  React.useEffect(() => {
    if (!automation.data) return;
    setDraft({
      enabled: automation.data.enabled,
      generationDay: automation.data.generationDay,
      periodStrategy: automation.data.periodStrategy,
      dueStrategy: automation.data.dueStrategy,
      dueDay: automation.data.dueDay,
      dueOffsetDays: automation.data.dueOffsetDays,
    });
  }, [automation.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ condoId, input: draft });
      toast.success(draft.enabled ? 'Automatic invoice generation enabled' : 'Automation saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function dryRun() {
    try {
      const res = await run.mutateAsync({ condoId, dryRun: true });
      setLastRun(res);
      toast.success(`Preview ready: ${res.wouldCreate} invoice(s) would be created`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function runNow() {
    if (!draft.enabled) {
      toast.error('Enable automatic invoice generation before running it');
      return;
    }
    const p = preview.data;
    const msg = p
      ? `Run automatic invoice generation now for ${fmtDate(p.periodStart)} to ${fmtDate(p.periodEnd)}? It will create up to ${p.wouldCreate} invoice(s); duplicates are skipped.`
      : 'Run automatic invoice generation now? Duplicates are skipped.';
    if (!window.confirm(msg)) return;
    try {
      const res = await run.mutateAsync({ condoId });
      setLastRun(res);
      toast.success(`Automatic generation created ${res.created} invoice(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const p = preview.data;
  const billingStage = status.data?.stages.find((s) => s.jobKey === 'BILLING_GENERATION');
  const previewStatus = p ? getPreviewStatus(p) : null;

  return (
    <Card id="automation" className="!p-5 sm:!p-6 scroll-mt-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">Automatic invoice generation</h3>
            <Badge tone={draft.enabled ? 'success' : 'neutral'}>
              {draft.enabled ? 'Enabled' : 'Off'}
            </Badge>
          </div>
          <p className="sr-muted text-sm mt-1">
            Let the system create monthly invoices from the fee schedule on schedule. This is
            duplicate-safe, so already billed periods are skipped instead of billed twice.
          </p>
        </div>
        <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 px-3 py-2 text-xs sr-muted min-w-[220px]">
          <div className="flex items-center gap-1.5 font-medium text-[rgb(var(--sr-fg))]">
            <GitBranch className="size-3.5 text-[rgb(var(--sr-coral))]" />
            Invoice automation status
          </div>
          {billingStage ? (
            <div className="mt-1">
              <Badge tone={STATUS_TONE[billingStage.status]}>
                {AUTOMATION_STATUS_LABELS[billingStage.status]}
              </Badge>
              <div className="mt-1">Next run: {fmtDateTime(billingStage.nextScheduledAt)}</div>
              <div>Last run: {fmtDateTime(billingStage.latestRun?.finishedAt ?? null)}</div>
            </div>
          ) : status.isLoading ? (
            <Skeleton className="h-10 mt-2" />
          ) : (
            <div className="mt-1">No runs recorded yet.</div>
          )}
        </div>
      </div>

      {automation.isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={save}>
          <label className="flex items-start gap-3 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="mt-1 size-4 rounded border-[rgb(var(--sr-border))]"
            />
            <span>
              <span className="block text-sm font-medium">
                Enable automatic monthly invoice generation
              </span>
              <span className="block text-xs sr-muted">
                Uses the fee schedule only. Units without configured rates are skipped, and
                duplicate active invoices for the same period are not created.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Generate on day</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={draft.generationDay}
                onChange={(e) => setDraft({ ...draft, generationDay: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Period to bill</Label>
              <select
                className={selectCls}
                value={draft.periodStrategy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    periodStrategy: e.target.value as BillingAutomationSettings['periodStrategy'],
                  })
                }
              >
                <option value="NEXT_MONTH">Next month</option>
                <option value="CURRENT_MONTH">Current month</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Due date</Label>
              <select
                className={selectCls}
                value={draft.dueStrategy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dueStrategy: e.target.value as BillingAutomationSettings['dueStrategy'],
                  })
                }
              >
                <option value="DAY_OF_MONTH">Fixed day each month</option>
                <option value="OFFSET_DAYS">Days after billing period starts</option>
              </select>
            </div>
            {draft.dueStrategy === 'DAY_OF_MONTH' ? (
              <div className="flex flex-col gap-1.5">
                <Label>Due on day</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={draft.dueDay}
                  onChange={(e) => setDraft({ ...draft, dueDay: Number(e.target.value) })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Days after period starts</Label>
                <Input
                  type="number"
                  min="0"
                  max="90"
                  value={draft.dueOffsetDays}
                  onChange={(e) => setDraft({ ...draft, dueOffsetDays: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {p ? (
            <div className="rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={previewStatus?.tone ?? 'neutral'}>{previewStatus?.badge}</Badge>
                <p className="font-medium text-[rgb(var(--sr-fg))]">{previewStatus?.title}</p>
              </div>
              <p className="sr-muted mt-1">{previewStatus?.description}</p>
              <ul className="mt-3 flex flex-col gap-1 text-[rgb(var(--sr-fg))]">
                <li>
                  <span className="font-medium">Next run:</span>{' '}
                  {p.dueToRun ? 'today' : fmtDate(p.runOnOrAfter)} (generates on day{' '}
                  {draft.generationDay})
                </li>
                <li>
                  <span className="font-medium">Creates invoices for:</span> up to {p.wouldCreate}{' '}
                  {plural(p.wouldCreate, 'unit')}
                </li>
                <li>
                  <span className="font-medium">Billing period:</span> {fmtDate(p.periodStart)} —{' '}
                  {fmtDate(p.periodEnd)}
                </li>
                <li>
                  <span className="font-medium">Due date:</span> {fmtDate(p.dueDate)}
                </li>
              </ul>
              <p className="sr-muted mt-2">{previewSentence(p)}</p>
            </div>
          ) : null}

          {lastRun ? (
            <div className="text-xs sr-muted">
              Last run: created {lastRun.created} invoice(s), skipped {lastRun.skipped} already
              billed, {lastRun.skippedNoRate} unit(s) without a fee rate.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving...' : 'Save settings'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={run.isPending}
              onClick={() => void dryRun()}
            >
              Preview without creating
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={run.isPending}
              onClick={() => void runNow()}
            >
              Generate invoices now
            </Button>
          </div>

          <p className="text-xs sr-muted">
            The overdue invoice check runs separately: it finds unpaid invoices after their due date
            and marks them overdue or sends reminders. It does not create new invoices.
          </p>
        </form>
      )}
    </Card>
  );
}
