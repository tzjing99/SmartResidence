'use client';

import { AdminPageHeader } from '@/components/admin-ui';
import { api, setActiveCondo } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { usePlatformCondoHealth, usePlatformCondoSummary } from '@smartresidence/api-client';
import { type PlatformAuditEvent, setupProgress } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { AlertTriangle, ArrowLeft, Building2, ChevronRight, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PlatformCondoDetailPage() {
  const router = useRouter();
  const { abilities, ready } = useRoleGuard('admin');
  const canView = hasAbility(abilities, 'read', 'Platform');
  const { id } = useParams<{ id: string }>();
  const summary = usePlatformCondoSummary(api, canView ? id : null);
  const health = usePlatformCondoHealth(api, canView ? id : null);

  React.useEffect(() => {
    if (ready && !canView) router.replace('/admin');
  }, [ready, canView, router]);

  function openCondoAdmin() {
    setActiveCondo(id);
    router.push('/admin');
  }

  if (!ready || !canView) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (summary.isLoading || health.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (summary.isError || !summary.data || health.isError || !health.data) {
    return (
      <EmptyState
        title="Condo not found"
        description="This building may have been removed or you lack access."
        action={
          <Button type="button" variant="secondary" asChild>
            <Link href="/admin/platform">
              <ArrowLeft className="size-4 mr-1" />
              Back to all condos
            </Link>
          </Button>
        }
      />
    );
  }

  const data = summary.data;
  const healthData = health.data;
  const progress = setupProgress(data.setup);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title={data.name}
        description={data.address}
        icon={Building2}
        actions={
          <Button type="button" variant="primary" onClick={openCondoAdmin}>
            Open condo admin
            <ChevronRight className="size-4 ml-1" />
          </Button>
        }
      />

      <Button type="button" variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/admin/platform">
          <ArrowLeft className="size-4 mr-1" />
          All condos
        </Link>
      </Button>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm sr-muted flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            Users
          </div>
          <div className="text-2xl font-semibold mt-1">{healthData.userCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted flex items-center gap-1.5">
            <Building2 className="size-4" aria-hidden />
            Units
          </div>
          <div className="text-2xl font-semibold mt-1">{healthData.unitCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted flex items-center gap-1.5">
            <AlertTriangle className="size-4" aria-hidden />
            Open defects
          </div>
          <div className="text-2xl font-semibold mt-1">{healthData.openDefectCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted flex items-center gap-1.5">
            <Receipt className="size-4" aria-hidden />
            Billing arrears
          </div>
          <div className="text-2xl font-semibold mt-1">
            {fmtMoney(healthData.billing.overdueAmount, healthData.billing.currencyCode)}
          </div>
          <p className="text-xs sr-muted mt-1">
            {healthData.billing.overdueInvoiceCount} overdue invoice
            {healthData.billing.overdueInvoiceCount === 1 ? '' : 's'}
          </p>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Setup status</h2>
          {data.setup.completedAt ? (
            <Badge tone="success">Complete</Badge>
          ) : data.setup.ready ? (
            <Badge tone="warning">Ready to finish</Badge>
          ) : (
            <Badge tone="neutral">In progress</Badge>
          )}
        </div>
        <p className="text-sm sr-muted">
          {progress.completed} of {progress.total} essential steps done
        </p>
        <ul className="space-y-2 text-sm">
          {data.setup.steps.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-2">
              <span className="capitalize">{step.key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="sr-muted">
                {step.done
                  ? 'Done'
                  : step.skipped
                    ? 'Skipped'
                    : step.satisfied
                      ? 'Auto'
                      : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Recent audit events</h2>
        {healthData.recentAuditEvents.length === 0 ? (
          <p className="text-sm sr-muted">No audit activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
            {healthData.recentAuditEvents.map((event: PlatformAuditEvent) => (
              <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {event.action} · {event.resourceType}
                      {event.resourceId ? (
                        <span className="sr-muted font-normal">
                          {' '}
                          ({event.resourceId.slice(0, 8)}…)
                        </span>
                      ) : null}
                    </p>
                    <p className="sr-muted mt-0.5">{event.actorName ?? 'System'}</p>
                  </div>
                  <time className="sr-muted shrink-0">{fmtDateTime(event.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Metadata</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="sr-muted">Slug</dt>
            <dd className="font-mono">{data.slug}</dd>
          </div>
          <div>
            <dt className="sr-muted">Management staff</dt>
            <dd>{data.managementCount}</dd>
          </div>
          <div>
            <dt className="sr-muted">Residents</dt>
            <dd>{data.residentCount}</dd>
          </div>
          <div>
            <dt className="sr-muted">Blocks</dt>
            <dd>{data.blockCount}</dd>
          </div>
          <div>
            <dt className="sr-muted">Timezone</dt>
            <dd>{data.timezone}</dd>
          </div>
          <div>
            <dt className="sr-muted">Currency</dt>
            <dd>{data.currencyCode}</dd>
          </div>
          <div>
            <dt className="sr-muted">Created</dt>
            <dd>{fmtDateTime(data.createdAt)}</dd>
          </div>
          <div>
            <dt className="sr-muted">Last activity</dt>
            <dd>{fmtDateTime(healthData.lastActivityAt)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
