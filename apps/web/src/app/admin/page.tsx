'use client';

import { api } from '@/lib/api';
import { queryKeys, useCondoDefects, useMyCondos } from '@smartresidence/api-client';
import { Card, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';

export default function AdminHome() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const defects = useCondoDefects(api, condo?.id ?? null);

  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id) : ['visitors', 'condo', null],
    queryFn: () =>
      condo ? api.visitorsForCondo(condo.id) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  const invoices = useQuery({
    queryKey: condo ? ['invoices', 'condo', condo.id] : ['invoices', 'condo', null],
    queryFn: () =>
      condo
        ? api['request' as keyof typeof api]
          ? // @ts-expect-error optional helper
            (api.invoicesForCondo?.(condo.id) ?? { items: [], total: 0 })
          : { items: [], total: 0 }
        : { items: [], total: 0 },
    enabled: Boolean(condo),
  });

  const openDefects =
    (defects.data?.items as any[] | undefined)?.filter(
      (d) => d.status !== 'CLOSED' && d.status !== 'RESOLVED',
    ).length ?? 0;
  const totalDefects = defects.data?.total ?? 0;
  const visitorsToday =
    (visitors.data?.items as any[] | undefined)?.filter((v) => {
      const d = new Date(v.expectedAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="sr-muted mt-1">{condo?.name ?? '—'}</p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm sr-muted">Visitors expected today</div>
          {visitors.isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="text-3xl font-semibold mt-2">{visitorsToday}</div>
          )}
        </Card>
        <Card>
          <div className="text-sm sr-muted">Open defects</div>
          {defects.isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="text-3xl font-semibold mt-2">{openDefects}</div>
          )}
          <div className="text-xs sr-muted mt-0.5">of {totalDefects} total</div>
        </Card>
        <Card>
          <div className="text-sm sr-muted">Open invoices</div>
          <div className="text-3xl font-semibold mt-2">—</div>
          <div className="text-xs sr-muted mt-0.5">connect billing data</div>
        </Card>
      </section>

      <Card>
        <h3 className="font-semibold mb-2">Recent activity</h3>
        <p className="text-sm sr-muted">
          For deep filtering use the{' '}
          <a href="/admin/audit" className="underline">
            audit log
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
