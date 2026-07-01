'use client';

import { api, setActiveCondo } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { usePlatformCondoSummary } from '@smartresidence/api-client';
import { setupProgress } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react';
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

export default function PlatformCondoDetailPage() {
  const router = useRouter();
  const { abilities, ready } = useRoleGuard('admin');
  const canView = hasAbility(abilities, 'read', 'Platform');
  const { id } = useParams<{ id: string }>();
  const summary = usePlatformCondoSummary(api, canView ? id : null);

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

  if (summary.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (summary.isError || !summary.data) {
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
  const progress = setupProgress(data.setup);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href="/admin/platform">
              <ArrowLeft className="size-4 mr-1" />
              All condos
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-6" />
            {data.name}
          </h1>
          <p className="sr-muted text-sm mt-1">{data.address}</p>
        </div>
        <Button type="button" variant="primary" onClick={openCondoAdmin}>
          Open condo admin
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm sr-muted">Units</div>
          <div className="text-2xl font-semibold mt-1">{data.unitCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted">Blocks</div>
          <div className="text-2xl font-semibold mt-1">{data.blockCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted">Residents</div>
          <div className="text-2xl font-semibold mt-1">{data.residentCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm sr-muted">Payment gateways</div>
          <div className="text-2xl font-semibold mt-1">{data.enabledGatewayCount}</div>
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
            <dd>{fmtDateTime(data.lastActivityAt)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
