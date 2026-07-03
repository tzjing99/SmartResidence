'use client';

import { DashboardSkeleton } from '@/components/route-skeletons';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { visitorStatusLabelKey, visitorStatusTone } from '@/lib/visitor-status';
import {
  useCondoAnnouncements,
  useMyCondos,
  useMyUnits,
  useUnitDefects,
  useUnitInvoices,
  useUnitStatement,
  useUnitVisitors,
} from '@smartresidence/api-client';
import { formatMoney, invoiceOutstanding, isInvoiceOverdue } from '@smartresidence/shared-types';
import { DEFECT_STATUS_LABELS, type DefectStatus } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Megaphone,
  Package,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type UnitSummary = { id: string; identifier: string; condoId: string };
type DashboardInvoice = {
  id: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID' | 'OVERDUE';
  total: number;
  amountPaid: number;
  currencyCode?: string;
  number: string;
  dueDate: string | Date;
  payments?: Array<{ status: string }>;
};
type DashboardDefect = {
  id: string;
  title?: string;
  status: string;
  severity?: string;
  createdAt?: string;
};
type DashboardVisitor = {
  id: string;
  name: string;
  expectedAt: string | Date;
  vehiclePlate?: string | null;
  status: string;
};
type DashboardAnnouncement = {
  id: string;
  title: string;
  importance: string;
  requiresAck?: boolean;
  ackedByMe?: boolean;
  publishedAt?: string | Date | null;
};

const IMPORTANCE_LABELS: Record<string, string> = {
  INFO: 'Info',
  IMPORTANT: 'Important',
  URGENT: 'Urgent',
};

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm sr-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline"
        >
          View <ChevronRight className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const unitItems = (units.data ?? []) as UnitSummary[];
  const [selectedUnitId, setSelectedUnitId] = React.useState<string>('');
  const unit = unitItems.find((u) => u.id === selectedUnitId) ?? unitItems[0] ?? undefined;
  const condo = condos.data?.[0];
  const visitors = useUnitVisitors(api, unit?.id ?? null, 'upcoming', { limit: 5 });
  const invoices = useUnitInvoices(api, unit?.id ?? null, { limit: 5 });
  const statement = useUnitStatement(api, unit?.id ?? null);
  const defects = useUnitDefects(api, unit?.id ?? null, { limit: 5 });
  const announcements = useCondoAnnouncements(api, condo?.id ?? null, { limit: 5 });

  React.useEffect(() => {
    if (!selectedUnitId && unitItems[0]) setSelectedUnitId(unitItems[0].id);
  }, [selectedUnitId, unitItems]);

  if (condos.isPending || units.isPending) {
    return <DashboardSkeleton />;
  }

  const invoiceItems = ((invoices.data?.items ?? []) as DashboardInvoice[])
    .filter((i) => i.status !== 'VOID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const activeInvoices = invoiceItems.filter((i) => i.status !== 'PAID');
  const overdueInvoice = activeInvoices.find((i) => isInvoiceOverdue(i));
  const pendingInvoice = activeInvoices.find((i) =>
    i.payments?.some((p) => p.status === 'PENDING'),
  );
  const nextInvoice = overdueInvoice ?? activeInvoices[0] ?? null;
  const outstandingTotal = activeInvoices.reduce((sum, inv) => sum + invoiceOutstanding(inv), 0);
  const openDefects = ((defects.data?.items ?? []) as DashboardDefect[]).filter(
    (d) => d.status !== 'CLOSED' && d.status !== 'RESOLVED',
  );
  const urgentDefects = openDefects.filter((d) => d.severity === 'URGENT' || d.severity === 'HIGH');
  const upcomingVisitors = ((visitors.data?.items ?? []) as DashboardVisitor[]).slice(0, 4);
  const nextVisitor = upcomingVisitors[0] ?? null;
  const announcementItems = ((announcements.data?.items ?? []) as DashboardAnnouncement[]).slice(
    0,
    4,
  );
  const ackAnnouncement = announcementItems.find((a) => a.requiresAck && !a.ackedByMe);
  const urgentAnnouncement =
    ackAnnouncement ??
    announcementItems.find((a) => a.importance === 'URGENT') ??
    announcementItems[0];

  const hero = overdueInvoice
    ? {
        tone: 'danger' as const,
        icon: AlertTriangle,
        title: t('dashboard.paymentOverdue'),
        body: `${overdueInvoice.number} is overdue. Outstanding ${formatMoney(
          invoiceOutstanding(overdueInvoice),
          overdueInvoice.currencyCode ?? 'MYR',
        )}.`,
        href: `/billing/${overdueInvoice.id}`,
        action: 'Pay now',
      }
    : pendingInvoice
      ? {
          tone: 'warning' as const,
          icon: CreditCard,
          title: 'Payment being confirmed',
          body: `${pendingInvoice.number} has a pending payment. Please wait for gateway confirmation before trying again.`,
          href: `/billing/${pendingInvoice.id}`,
          action: 'View invoice',
        }
      : ackAnnouncement
        ? {
            tone: 'warning' as const,
            icon: Megaphone,
            title: 'Notice needs acknowledgement',
            body: ackAnnouncement.title,
            href: `/announcements/${ackAnnouncement.id}`,
            action: 'Acknowledge',
          }
        : nextVisitor
          ? {
              tone: 'neutral' as const,
              icon: Users,
              title: 'Next visitor expected',
              body: `${nextVisitor.name} · ${fmtDateTime(nextVisitor.expectedAt)}`,
              href: '/visitors',
              action: 'View visitors',
            }
          : {
              tone: 'success' as const,
              icon: CheckCircle2,
              title: 'All clear for now',
              body: 'No urgent payments, visitor arrivals or notices need action.',
              href: '/announcements',
              action: 'View notices',
            };
  const HeroIcon = hero.icon;
  const heroClass =
    hero.tone === 'danger'
      ? 'border-red-200/70 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20'
      : hero.tone === 'warning'
        ? 'border-amber-200/70 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20'
        : hero.tone === 'success'
          ? 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : '';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm sr-muted">{condo?.name ?? 'Your condo'}</p>
          <h2 className="sr-section-title">Welcome{unit ? `, unit ${unit.identifier}` : ''}.</h2>
        </div>
        {unitItems.length > 1 ? (
          <div className="flex flex-col gap-1.5 min-w-48">
            <label htmlFor="dashboard-unit" className="text-xs sr-muted">
              Viewing unit
            </label>
            <select
              id="dashboard-unit"
              className="sr-select"
              value={unit?.id ?? ''}
              onChange={(e) => setSelectedUnitId(e.target.value)}
            >
              {unitItems.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.identifier}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <Card className={heroClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[rgb(var(--sr-card))] border border-[rgb(var(--sr-border))]">
              <HeroIcon className="size-5 text-[rgb(var(--sr-coral))]" />
            </span>
            <div>
              <div className="text-sm sr-muted">{t("dashboard.nextAction")}</div>
              <h3 className="text-2xl font-semibold mt-1">{hero.title}</h3>
              <p className="text-sm sr-muted mt-1">{hero.body}</p>
            </div>
          </div>
          <Link href={hero.href}>
            <Button>{hero.action}</Button>
          </Link>
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <Card>
          <SectionHeader
            title="Money"
            subtitle="Your current balance and next fee statement."
            href="/billing"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs uppercase sr-muted font-semibold">{t("dashboard.outstanding")}</div>
              <div className="text-xl font-bold mt-1">
                {formatMoney(statement.data?.totalOutstanding ?? outstandingTotal)}
              </div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs uppercase sr-muted font-semibold">Advance credit</div>
              <div className="text-xl font-bold mt-1">
                {formatMoney(statement.data?.creditBalance ?? 0)}
              </div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs uppercase sr-muted font-semibold">Next due</div>
              <div className="text-sm font-semibold mt-1">
                {nextInvoice ? fmtDate(nextInvoice.dueDate) : 'Nothing due'}
              </div>
              {nextInvoice ? (
                <Link
                  href={`/billing/${nextInvoice.id}`}
                  className="text-xs text-coral-500 hover:underline"
                >
                  {nextInvoice.number}
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Home requests"
            subtitle="Defect reports and maintenance follow-up."
            href="/defects"
          />
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-[rgb(var(--sr-bg))]">
              <Wrench className="size-5 sr-muted" />
            </span>
            <div>
              <div className="text-2xl font-semibold">{openDefects.length}</div>
              <div className="text-sm sr-muted">
                open request{openDefects.length === 1 ? '' : 's'}
                {urgentDefects.length ? ` · ${urgentDefects.length} urgent` : ''}
              </div>
            </div>
          </div>
          {openDefects[0] ? (
            <div className="mt-4 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3 text-sm">
              <div className="font-medium">{openDefects[0].title ?? 'Latest request'}</div>
              <div className="text-xs sr-muted mt-0.5">
                {DEFECT_STATUS_LABELS[openDefects[0].status as DefectStatus] ??
                  openDefects[0].status.toLowerCase()}
                {openDefects[0].createdAt ? ` · ${fmtDate(openDefects[0].createdAt)}` : ''}
              </div>
            </div>
          ) : (
            <p className="text-sm sr-muted mt-4">No open requests for this unit.</p>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader
            title="Visitors"
            subtitle="Upcoming arrivals for your household."
            href="/visitors"
          />
          {upcomingVisitors.length === 0 ? (
            <EmptyState
              title={t("dashboard.noVisitorsTitle")}
              description="Pre-register friends, family, or contractors to skip the gate friction."
              action={
                <Link href="/visitors/new">
                  <Button>Pre-register a visitor</Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3 mt-4">
              {upcomingVisitors.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgb(var(--sr-bg))]"
                >
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs sr-muted">
                      {new Date(v.expectedAt).toLocaleString()}
                      {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                    </div>
                  </div>
                  <Badge tone={visitorStatusTone(v.status)}>
                    {t(visitorStatusLabelKey(v.status))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Notices"
            subtitle="Important updates from management."
            href="/announcements"
          />
          {announcementItems.length === 0 ? (
            <EmptyState
              title={t("dashboard.noAnnouncementsTitle")}
              description="Building notices and updates from management will show up here."
              action={
                <Link href="/announcements">
                  <Button variant="secondary" size="sm">
                    Open notices
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3 mt-4">
              {announcementItems.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[rgb(var(--sr-border))]/70 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.title}</div>
                    <div className="text-xs sr-muted mt-0.5">
                      {a.publishedAt ? fmtDate(a.publishedAt) : 'Recently posted'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {a.importance !== 'INFO' ? (
                      <Badge tone={a.importance === 'URGENT' ? 'danger' : 'warning'}>
                        {IMPORTANCE_LABELS[a.importance] ?? a.importance}
                      </Badge>
                    ) : null}
                    {a.requiresAck && !a.ackedByMe ? <Badge tone="info">Ack needed</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {urgentAnnouncement ? (
            <Link
              href={`/announcements/${urgentAnnouncement.id}`}
              className="inline-flex items-center gap-1 text-xs text-coral-500 hover:underline mt-3"
            >
              Open latest notice <ChevronRight className="size-3" />
            </Link>
          ) : null}
        </Card>
      </section>

      <section>
        <h3 className="text-sm font-semibold sr-muted mb-3">{t("dashboard.quickLinks")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/billing">
            <Card interactive className="h-full !p-4">
              <CreditCard className="size-5 sr-muted mb-2" />
              <div className="font-medium text-sm">Fees</div>
              <div className="text-xs sr-muted">Invoices & deposits</div>
            </Card>
          </Link>
          <Link href="/visitors/new">
            <Card interactive className="h-full !p-4">
              <CalendarClock className="size-5 sr-muted mb-2" />
              <div className="font-medium text-sm">Visitors</div>
              <div className="text-xs sr-muted">Pre-register a guest</div>
            </Card>
          </Link>
          <Link href="/defects/new">
            <Card interactive className="h-full !p-4">
              <Wrench className="size-5 sr-muted mb-2" />
              <div className="font-medium text-sm">Report issue</div>
              <div className="text-xs sr-muted">Defects & repairs</div>
            </Card>
          </Link>
          <Link href="/parcels">
            <Card interactive className="h-full !p-4">
              <Package className="size-5 sr-muted mb-2" />
              <div className="font-medium text-sm">Parcels</div>
              <div className="text-xs sr-muted">Lobby deliveries</div>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
