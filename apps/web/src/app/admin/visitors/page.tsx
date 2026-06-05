'use client';

import { api } from '@/lib/api';
import { queryKeys, useMyCondos } from '@smartresidence/api-client';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';

export default function AdminVisitorsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id) : ['visitors', 'condo', null],
    queryFn: () =>
      condo ? api.visitorsForCondo(condo.id) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Visitors</h1>
        <p className="sr-muted">Live visitor log across the condo.</p>
      </header>
      {visitors.isLoading ? (
        <Skeleton className="h-40" />
      ) : (visitors.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No visitors yet" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted">
              <tr>
                <th className="py-2">Visitor</th>
                <th>Unit</th>
                <th>Host</th>
                <th>Expected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(visitors.data?.items as any[]).map((v) => (
                <tr key={v.id}>
                  <td className="py-3 font-medium">{v.name}</td>
                  <td>{v.unit?.identifier ?? '—'}</td>
                  <td className="sr-muted">{v.host?.name ?? '—'}</td>
                  <td className="sr-muted">{new Date(v.expectedAt).toLocaleString()}</td>
                  <td>
                    <Badge
                      tone={
                        v.status === 'CHECKED_IN'
                          ? 'success'
                          : v.status === 'CANCELLED' || v.status === 'REJECTED'
                            ? 'danger'
                            : 'primary'
                      }
                    >
                      {v.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
