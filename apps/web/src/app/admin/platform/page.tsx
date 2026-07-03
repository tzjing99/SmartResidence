'use client';

import { api, setActiveCondo } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { usePlatformCondos } from '@smartresidence/api-client';
import type { PlatformCondoSummary } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@smartresidence/ui-web';
import { Building2, ChevronRight, Search, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

function fmtDateTime(value?: string | null) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setupBadge(condo: PlatformCondoSummary) {
  if (condo.setupCompleted) return <Badge tone="success">Setup complete</Badge>;
  if (condo.setupReady) return <Badge tone="warning">Ready to finish</Badge>;
  return <Badge tone="neutral">In progress</Badge>;
}

export default function PlatformCondosPage() {
  const router = useRouter();
  const { abilities, ready } = useRoleGuard('admin');
  const canView = hasAbility(abilities, 'read', 'Platform');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const condos = usePlatformCondos(api, { search: debounced }, { enabled: ready && canView });

  React.useEffect(() => {
    if (ready && !canView) router.replace('/admin');
  }, [ready, canView, router]);

  function openCondoAdmin(condoId: string) {
    setActiveCondo(condoId);
    router.push('/admin');
  }

  if (!ready || !canView) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="size-6" />
          Platform console
        </h1>
        <p className="sr-muted text-sm mt-1">Cross-condo health overview for platform operators.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 sr-muted pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, slug, or address…"
          className="pl-9"
          aria-label="Search condos"
        />
      </div>

      {condos.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : (condos.data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          title="No condos found"
          description={
            debounced ? 'Try a different search term.' : 'No buildings on the platform yet.'
          }
        />
      ) : (
        <div className="space-y-3">
          {condos.data?.items?.map((condo: PlatformCondoSummary) => (
            <Card key={condo.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="size-4 shrink-0 sr-muted" />
                    <h2 className="font-semibold text-lg">{condo.name}</h2>
                    {setupBadge(condo)}
                  </div>
                  <p className="text-sm sr-muted mt-1">{condo.address}</p>
                  <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <dt className="sr-muted">Units</dt>
                      <dd className="font-medium">{condo.unitCount}</dd>
                    </div>
                    <div>
                      <dt className="sr-muted">Gateways</dt>
                      <dd className="font-medium">{condo.enabledGatewayCount}</dd>
                    </div>
                    <div>
                      <dt className="sr-muted">Timezone</dt>
                      <dd className="font-medium">{condo.timezone}</dd>
                    </div>
                    <div>
                      <dt className="sr-muted">Last activity</dt>
                      <dd className="font-medium">{fmtDateTime(condo.lastActivityAt)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs sr-muted mt-2">
                    Slug <code className="font-mono">{condo.slug}</code>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button type="button" variant="primary" onClick={() => openCondoAdmin(condo.id)}>
                    Open admin
                  </Button>
                  <Button type="button" variant="secondary" asChild>
                    <Link href={`/admin/platform/${condo.id}`}>
                      Details
                      <ChevronRight className="size-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
