'use client';

import { PillTabs } from '@/components/pill-tabs';
import { api } from '@/lib/api';
import { queryKeys, useMyCondos } from '@smartresidence/api-client';
import type { Visitor, VisitorListView } from '@smartresidence/shared-types';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type AdminVisitorRow = Visitor & {
  unit?: { identifier: string } | null;
  host?: { name: string } | null;
};

type AdminTab = 'live' | 'history';

const TAB_ITEMS: { id: AdminTab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'history', label: 'Logs' },
];

export default function AdminVisitorsPage() {
  const [tab, setTab] = useState<AdminTab>('live');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const view: VisitorListView = tab === 'live' ? 'upcoming' : 'history';
  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id, view) : ['visitors', 'condo', null],
    queryFn: () =>
      condo ? api.visitorsForCondo(condo.id, { view }) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Visitors</h1>
        <p className="sr-muted">Live visitor log across the condo.</p>
      </header>

      <PillTabs items={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Visitor admin views" />

      {visitors.isLoading ? (
        <Skeleton className="h-40" />
      ) : (visitors.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={tab === 'live' ? 'No active visitors' : 'No historical records'}
          description={
            tab === 'live'
              ? 'Approved passes and pending walk-ins appear here.'
              : 'Checked-out, expired, and rejected visits are logged here.'
          }
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted">
              <tr>
                <th className="py-2">Visitor</th>
                <th>Unit</th>
                <th>Host</th>
                <th>{tab === 'live' ? 'Expected' : 'Visit date'}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(visitors.data?.items as AdminVisitorRow[]).map((v) => (
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
                          : v.status === 'CANCELLED' ||
                              v.status === 'REJECTED' ||
                              v.status === 'EXPIRED'
                            ? 'danger'
                            : 'primary'
                      }
                    >
                      {v.status.toLowerCase().replace(/_/g, ' ')}
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
