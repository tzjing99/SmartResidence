'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  queryKeys,
  useArrearsAging,
  useAutomationStatus,
  useCollectionsSummary,
  useCondoAnnouncements,
  useCondoDefects,
  useCondoSosAlerts,
  useMyCondos,
  usePaymentIssues,
  useSetupStatus,
  useDismissSetup,
} from '@smartresidence/api-client';
import type { AutomationRunStatus } from '@smartresidence/shared-types';
import {
  AUTOMATION_STATUS_LABELS,
  formatMoney,
  isFreshSetupInstance,
  setupProgress,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ChevronRight,
  CreditCard,
  GitBranch,
  Megaphone,
  Rocket,
  ShieldCheck,
  Siren,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function fmtDateTime(value?: string | null) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const AUTOMATION_TONE: Record<
  AutomationRunStatus,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  PENDING: 'info',
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

function MetricCard({
  label,
  value,
  detail,
  href,
  loading,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
  loading?: boolean;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200/70 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20'
      : tone === 'warning'
        ? 'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
        : tone === 'success'
          ? 'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : '';

  return (
    <Card className={toneClass}>
      <div className="text-sm sr-muted">{label}</div>
      {loading ? (
        <Skeleton className="h-8 w-24 mt-2" />
      ) : (
        <div className="text-3xl font-semibold mt-2">{value}</div>
      )}
      {detail ? <div className="text-xs sr-muted mt-0.5">{detail}</div> : null}
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline mt-3"
        >
          Open <ChevronRight className="size-3" />
        </Link>
      ) : null}
    </Card>
  );
}

function ActionItem({
  icon: Icon,
  title,
  detail,
  href,
  tone = 'neutral',
}: {
  icon: typeof AlertTriangle;
  title: string;
  detail: string;
  href: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const iconClass =
    tone === 'danger'
      ? 'text-red-600 bg-red-50 dark:bg-red-950/30'
      : tone === 'warning'
        ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
        : tone === 'success'
          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
          : 'text-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral)/0.08)]';

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3 transition-colors hover:bg-[rgb(var(--sr-bg))]/70"
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${iconClass}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs sr-muted mt-0.5">{detail}</span>
      </span>
      <ChevronRight className="size-4 sr-muted mt-2" />
    </Link>
  );
}

function SetupBanner({ condoId }: { condoId: string }) {
  const setup = useSetupStatus(api, condoId);
  const dismissSetup = useDismissSetup(api);

  const data = setup.data;
  if (!data || data.completedAt || data.dismissedAt) return null;

  const progress = setupProgress(data);
  const fresh = isFreshSetupInstance(data.facts);
  const dismiss = () => {
    dismissSetup.mutate(
      { condoId },
      {
        onError: () => toast.error('Could not dismiss setup reminder'),
      },
    );
  };

  return (
    <Card className="border-coral-500/30 bg-coral-500/5">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-coral-500/10 text-coral-500">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {fresh ? 'Welcome — let’s set up your building' : 'Finish setting up your building'}
          </h2>
          <p className="text-sm sr-muted mt-0.5">
            {fresh
              ? 'This is a blank building with no units yet. The guided setup walks you through blocks, billing, and resident invites step by step.'
              : `${progress.completed} of ${progress.total} steps done. Continue the checklist to get billing and residents running.`}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button asChild size="sm">
              <Link href="/admin/setup">
                {fresh ? 'Start guided setup' : 'Continue setup'} <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Do this later
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup reminder"
          className="sr-muted hover:text-[rgb(var(--sr-fg))] transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </Card>
  );
}

function SosBanner({ condoId }: { condoId: string }) {
  const alerts = useCondoSosAlerts(api, condoId);
  const active = alerts.data?.active ?? [];
  if (active.length === 0) return null;

  return (
    <Link
      href="/admin/safety"
      className="flex items-center gap-4 rounded-2xl border border-red-300/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30 p-4 transition-colors hover:bg-red-100/70 dark:hover:bg-red-950/50"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 animate-pulse">
        <Siren className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
          {active.length} active SOS alert{active.length === 1 ? '' : 's'}
        </h2>
        <p className="text-sm text-red-700/80 dark:text-red-300/80 mt-0.5">
          Residents or guards need urgent help. Open the safety console to respond now.
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-red-600 dark:text-red-400" />
    </Link>
  );
}

export default function AdminHome() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const defects = useCondoDefects(api, condo?.id ?? null);
  const arrears = useArrearsAging(api, condo?.id ?? null);
  const collections = useCollectionsSummary(api, condo?.id ?? null, {
    from: monthStartIso(),
    to: new Date().toISOString().slice(0, 10),
  });
  const paymentIssues = usePaymentIssues(api, condo?.id ?? null);
  const automation = useAutomationStatus(api, condo?.id ?? null);
  const announcements = useCondoAnnouncements(api, condo?.id ?? null);

  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id) : ['visitors', 'condo', null],
    queryFn: () =>
      condo ? api.visitorsForCondo(condo.id) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  const openDefects =
    (defects.data?.items as Array<{ status: string }> | undefined)?.filter(
      (d) => d.status !== 'CLOSED' && d.status !== 'RESOLVED',
    ).length ?? 0;
  const totalDefects = defects.data?.total ?? 0;
  const todayString = new Date().toDateString();
  const visitorsToday =
    (visitors.data?.items as Array<{ expectedAt: string }> | undefined)?.filter(
      (v) => new Date(v.expectedAt).toDateString() === todayString,
    ).length ?? 0;
  const visitorItems =
    (visitors.data?.items as
      | Array<{
          id: string;
          name: string;
          expectedAt: string;
          unit?: { identifier?: string } | null;
        }>
      | undefined) ?? [];
  const upcomingVisitors = visitorItems
    .filter((v) => new Date(v.expectedAt).getTime() >= Date.now() - 60 * 60 * 1000)
    .slice(0, 4);
  const defectItems =
    (defects.data?.items as
      | Array<{ id: string; title?: string; status: string; severity?: string; createdAt?: string }>
      | undefined) ?? [];
  const urgentDefects = defectItems.filter(
    (d) =>
      d.status !== 'CLOSED' &&
      d.status !== 'RESOLVED' &&
      (d.severity === 'URGENT' || d.severity === 'HIGH'),
  ).length;
  const paymentIssueCount = paymentIssues.data?.length ?? 0;
  const arrearsTotal = arrears.data?.totalOutstanding ?? 0;
  const billingStage = automation.data?.stages.find((s) => s.jobKey === 'BILLING_GENERATION');
  const dueSweepStage = automation.data?.stages.find((s) => s.jobKey === 'DUE_SWEEP');
  const latestAnnouncements =
    (announcements.data?.items as
      | Array<{ id: string; title: string; importance: string; publishedAt?: string | null }>
      | undefined) ?? [];
  const priorityActions = [
    ...(paymentIssueCount > 0
      ? [
          {
            icon: CreditCard,
            title: `${paymentIssueCount} payment issue${paymentIssueCount === 1 ? '' : 's'} to review`,
            detail: 'Failed online payments or held payments need your review.',
            href: '/admin/accounting',
            tone: 'danger' as const,
          },
        ]
      : []),
    ...(arrearsTotal > 0
      ? [
          {
            icon: Wallet,
            title: `${formatMoney(arrearsTotal)} outstanding`,
            detail: `${arrears.data?.unitsInArrears ?? 0} unit(s) have unpaid invoices.`,
            href: '/admin/accounting',
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(urgentDefects > 0
      ? [
          {
            icon: Wrench,
            title: `${urgentDefects} urgent defect${urgentDefects === 1 ? '' : 's'}`,
            detail: 'High-priority maintenance items need follow-up.',
            href: '/admin/defects',
            tone: 'warning' as const,
          },
        ]
      : []),
    {
      icon: GitBranch,
      title: billingStage
        ? `Automatic invoices: ${AUTOMATION_STATUS_LABELS[billingStage.status]}`
        : 'Automatic invoice status',
      detail: billingStage
        ? `Next run ${fmtDateTime(billingStage.nextScheduledAt)}`
        : 'Set up and monitor automatic monthly invoice generation.',
      href: '/admin/invoices',
      tone: billingStage?.status === 'FAILED' ? ('danger' as const) : ('neutral' as const),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      {condo ? <SosBanner condoId={condo.id} /> : null}
      {condo ? <SetupBanner condoId={condo.id} /> : null}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm sr-muted">Management dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight">{condo?.name ?? 'Dashboard'}</h1>
        </div>
        <Badge tone={automation.isFetching ? 'warning' : 'neutral'} className="self-start">
          <CalendarClock className="size-3.5" />
          {automation.isFetching ? 'Refreshing' : 'Live overview'}
        </Badge>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6">
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Needs attention</h2>
              <p className="text-sm sr-muted">The most important items for management today.</p>
            </div>
            <ShieldCheck className="size-5 sr-muted" />
          </div>
          <div className="grid gap-3">
            {priorityActions.length > 0 ? (
              priorityActions.map((item) => <ActionItem key={item.title} {...item} />)
            ) : (
              <EmptyState
                title="No urgent items"
                description="Payments, overdue invoices, defects and automations are all quiet right now."
              />
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="size-4 text-[rgb(var(--sr-coral))]" />
            <h2 className="text-lg font-semibold">Invoice automation</h2>
          </div>
          {automation.isLoading ? (
            <Skeleton className="h-28" />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--sr-border))]/70 pb-3">
                <span className="sr-muted">Generate invoices</span>
                <span className="text-right">
                  {billingStage ? (
                    <>
                      <Badge tone={AUTOMATION_TONE[billingStage.status]}>
                        {AUTOMATION_STATUS_LABELS[billingStage.status]}
                      </Badge>
                      <span className="block text-xs sr-muted mt-1">
                        Next {fmtDateTime(billingStage.nextScheduledAt)}
                      </span>
                    </>
                  ) : (
                    'Not configured'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="sr-muted">Overdue check</span>
                <span className="text-right">
                  {dueSweepStage ? (
                    <>
                      <Badge tone={AUTOMATION_TONE[dueSweepStage.status]}>
                        {AUTOMATION_STATUS_LABELS[dueSweepStage.status]}
                      </Badge>
                      <span className="block text-xs sr-muted mt-1">
                        Next {fmtDateTime(dueSweepStage.nextScheduledAt)}
                      </span>
                    </>
                  ) : (
                    'Event based'
                  )}
                </span>
              </div>
              <Link
                href="/admin/invoices"
                className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline"
              >
                Manage invoice automation <ChevronRight className="size-3" />
              </Link>
            </div>
          )}
        </Card>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Unpaid invoices"
          value={formatMoney(arrearsTotal)}
          detail={`${arrears.data?.unitsInArrears ?? 0} unit(s) · ${arrears.data?.invoicesInArrears ?? 0} invoice(s)`}
          href="/admin/accounting"
          loading={arrears.isLoading}
          tone={arrearsTotal > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Collections this month"
          value={formatMoney(collections.data?.total ?? 0)}
          detail={`${collections.data?.count ?? 0} payment(s) collected`}
          href="/admin/accounting"
          loading={collections.isLoading}
        />
        <MetricCard
          label="Payment issues"
          value={paymentIssueCount}
          detail="Failed online payments or payments held for review"
          href="/admin/accounting"
          loading={paymentIssues.isLoading}
          tone={paymentIssueCount > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="Open defects"
          value={openDefects}
          detail={`${urgentDefects} urgent · ${totalDefects} total`}
          href="/admin/defects"
          loading={defects.isLoading}
          tone={urgentDefects > 0 ? 'warning' : openDefects > 0 ? 'neutral' : 'success'}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 sr-muted" />
            <h2 className="font-semibold">Operations today</h2>
          </div>
          <div className="grid gap-3">
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs sr-muted">Visitors expected today</div>
              <div className="text-2xl font-semibold mt-1">{visitorsToday}</div>
              <Link href="/admin/visitors" className="text-xs text-coral-500 hover:underline mt-2">
                View visitor log
              </Link>
            </div>
            {upcomingVisitors.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {upcomingVisitors.map((v) => (
                  <li key={v.id} className="text-sm rounded-xl bg-[rgb(var(--sr-bg))]/70 p-3">
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs sr-muted">
                      {fmtDateTime(v.expectedAt)}
                      {v.unit?.identifier ? ` · Unit ${v.unit.identifier}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm sr-muted">No upcoming visitors in the current list.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="size-4 sr-muted" />
            <h2 className="font-semibold">Communications</h2>
          </div>
          {announcements.isLoading ? (
            <Skeleton className="h-28" />
          ) : latestAnnouncements.length === 0 ? (
            <p className="text-sm sr-muted">No announcements yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {latestAnnouncements.slice(0, 4).map((a) => (
                <li key={a.id} className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="size-3.5 sr-muted" />
                    <span className="text-sm font-medium truncate">{a.title}</span>
                  </div>
                  <div className="text-xs sr-muted mt-1">
                    {a.importance.toLowerCase()}
                    {a.publishedAt ? ` · ${fmtDateTime(a.publishedAt)}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/announcements"
            className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline mt-3"
          >
            Manage announcements <ChevronRight className="size-3" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 sr-muted" />
            <h2 className="font-semibold">Recent activity</h2>
          </div>
          <p className="text-sm sr-muted">
            Use the audit log for detailed account, billing and management activity.
          </p>
          <Link
            href="/admin/settings/audit"
            className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline mt-3"
          >
            Open audit log <ChevronRight className="size-3" />
          </Link>
        </Card>
      </section>
    </div>
  );
}
