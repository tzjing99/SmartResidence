'use client';

import { api } from '@/lib/api';
import { useMyCondos } from '@smartresidence/api-client';
import { Card, EmptyState, Input, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function AdminUnitsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [search, setSearch] = useState('');

  const units = useQuery({
    queryKey: ['admin', 'units', condo?.id, search],
    queryFn: () =>
      condo
        ? api.listUnits(condo.id, { search: search || undefined, limit: 100 })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Residents & units</h1>
          <p className="sr-muted">{units.data?.total ?? 0} units</p>
        </div>
        <div className="w-72">
          <Input
            placeholder="Search by unit number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {units.isLoading ? (
        <Skeleton className="h-96" />
      ) : (units.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No units" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted bg-[rgb(var(--sr-bg))]">
              <tr>
                <th className="py-3 px-4">Unit</th>
                <th>Block</th>
                <th>Sqft</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(units.data?.items as any[]).map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium">{u.identifier}</td>
                  <td>{u.block?.name ?? '—'}</td>
                  <td className="sr-muted">{u.sqft ?? '—'}</td>
                  <td>
                    {u.ownerships?.[0]?.user?.name ?? <span className="sr-muted">unassigned</span>}
                  </td>
                  <td className="sr-muted">{u.status.toLowerCase().replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
