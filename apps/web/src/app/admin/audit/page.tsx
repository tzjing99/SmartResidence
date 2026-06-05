'use client';

import { api } from '@/lib/api';
import { useMyCondos } from '@smartresidence/api-client';
import { Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';

export default function AdminAuditPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  const logs = useQuery({
    queryKey: ['audit', 'logs', condo?.id],
    queryFn: () => {
      if (!condo) return Promise.resolve({ items: [], total: 0 });
      const token = JSON.parse(localStorage.getItem('sr.session.v1') ?? '{}').accessToken ?? '';
      return fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/audit/logs?condoId=${condo.id}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
        .then((r) => r.json())
        .then((d) => d.data ?? d);
    },
    enabled: Boolean(condo),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="sr-muted">
          Every mutating action across the condo. Filter by resource type, actor, or action.
        </p>
      </header>
      {logs.isLoading ? (
        <Skeleton className="h-96" />
      ) : (logs.data?.items?.length ?? 0) === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted bg-[rgb(var(--sr-bg))]">
              <tr>
                <th className="py-3 px-4">When</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {logs.data?.items?.map((row: any) => (
                <tr key={row.id}>
                  <td className="py-3 px-4 sr-muted">{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.actor?.name ?? '—'}</td>
                  <td className="sr-muted">{row.actorRole ?? '—'}</td>
                  <td className="font-medium">{row.action}</td>
                  <td className="sr-muted">{row.resourceType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
