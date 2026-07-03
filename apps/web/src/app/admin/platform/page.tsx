'use client';

import { AdminPageHeader } from '@/components/admin-ui';
import { api, setActiveCondo } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useCreatePlatformCondo, usePlatformCondos } from '@smartresidence/api-client';
import type { PlatformCondoSummary } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Search,
  Store,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const PAGE_SIZE = 20;

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

function healthBadges(condo: PlatformCondoSummary) {
  const badges: React.ReactNode[] = [];
  if (condo.openDefectCount > 0) {
    badges.push(
      <Badge key="defects" tone="warning">
        {condo.openDefectCount} open defect{condo.openDefectCount === 1 ? '' : 's'}
      </Badge>,
    );
  }
  if (condo.overdueInvoiceCount > 0) {
    badges.push(
      <Badge key="invoices" tone="danger">
        {condo.overdueInvoiceCount} overdue invoice{condo.overdueInvoiceCount === 1 ? '' : 's'}
      </Badge>,
    );
  }
  return badges;
}

export default function PlatformCondosPage() {
  const router = useRouter();
  const { abilities, ready } = useRoleGuard('admin');
  const canView = hasAbility(abilities, 'read', 'Platform');
  const canManage = hasAbility(abilities, 'manage', 'Platform');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [showProvision, setShowProvision] = React.useState(false);
  const [provisionForm, setProvisionForm] = React.useState({
    name: '',
    slug: '',
    address: '',
    timezone: 'Asia/Kuala_Lumpur',
  });

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const condos = usePlatformCondos(
    api,
    { search: debounced, limit: PAGE_SIZE, offset },
    { enabled: ready && canView },
  );
  const createCondo = useCreatePlatformCondo(api);

  React.useEffect(() => {
    if (ready && !canView) router.replace('/admin');
  }, [ready, canView, router]);

  function openCondoAdmin(condoId: string) {
    setActiveCondo(condoId);
    router.push('/admin');
  }

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await createCondo.mutateAsync({
        name: provisionForm.name.trim(),
        slug: provisionForm.slug.trim().toLowerCase(),
        address: provisionForm.address.trim(),
        timezone: provisionForm.timezone.trim(),
      });
      toast.success(`Created ${created.name}`);
      setProvisionForm({ name: '', slug: '', address: '', timezone: 'Asia/Kuala_Lumpur' });
      setShowProvision(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create condo');
    }
  }

  const items = condos.data?.items ?? [];
  const total = condos.data?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  if (!ready || !canView) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Platform console"
        description="Cross-condo health overview for platform operators."
        icon={Store}
        actions={
          canManage ? (
            <Button type="button" variant="secondary" onClick={() => setShowProvision((v) => !v)}>
              {showProvision ? 'Cancel' : 'Provision new condo'}
            </Button>
          ) : null
        }
      />

      {showProvision && canManage ? (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Provision new condo</h2>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProvision}>
            <label className="space-y-1 text-sm">
              <span className="sr-muted">Name</span>
              <Input
                value={provisionForm.name}
                onChange={(e) => setProvisionForm((f) => ({ ...f, name: e.target.value }))}
                required
                minLength={2}
                placeholder="Acacia Residences"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="sr-muted">Slug</span>
              <Input
                value={provisionForm.slug}
                onChange={(e) => setProvisionForm((f) => ({ ...f, slug: e.target.value }))}
                required
                minLength={2}
                placeholder="acacia-residences"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="sr-muted">Address</span>
              <Input
                value={provisionForm.address}
                onChange={(e) => setProvisionForm((f) => ({ ...f, address: e.target.value }))}
                required
                minLength={5}
                placeholder="12 Jalan Demo, Kuala Lumpur"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="sr-muted">Timezone</span>
              <Input
                value={provisionForm.timezone}
                onChange={(e) => setProvisionForm((f) => ({ ...f, timezone: e.target.value }))}
                required
                placeholder="Asia/Kuala_Lumpur"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={createCondo.isPending}>
                {createCondo.isPending ? 'Creating…' : 'Create condo'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

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
      ) : items.length === 0 ? (
        <EmptyState
          title="No condos found"
          description={
            debounced ? 'Try a different search term.' : 'No buildings on the platform yet.'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((condo) => (
              <Card key={condo.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="size-4 shrink-0 sr-muted" />
                      <h2 className="font-semibold text-lg">{condo.name}</h2>
                      {setupBadge(condo)}
                      {healthBadges(condo)}
                    </div>
                    <p className="text-sm sr-muted mt-1">{condo.address}</p>
                    <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                      <div>
                        <dt className="sr-muted flex items-center gap-1">
                          <Building2 className="size-3.5" aria-hidden />
                          Units
                        </dt>
                        <dd className="font-medium">{condo.unitCount}</dd>
                      </div>
                      <div>
                        <dt className="sr-muted flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          Users
                        </dt>
                        <dd className="font-medium">{condo.userCount}</dd>
                      </div>
                      <div>
                        <dt className="sr-muted flex items-center gap-1">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          Open defects
                        </dt>
                        <dd className="font-medium">{condo.openDefectCount}</dd>
                      </div>
                      <div>
                        <dt className="sr-muted flex items-center gap-1">
                          <Receipt className="size-3.5" aria-hidden />
                          Overdue
                        </dt>
                        <dd className="font-medium">{condo.overdueInvoiceCount}</dd>
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

          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="sr-muted">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!hasPrev}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
