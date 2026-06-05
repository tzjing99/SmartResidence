'use client';

import { PillTabs } from '@/components/pill-tabs';
import { api } from '@/lib/api';
import { queryKeys, useApproveOvernightVisitor, useMyCondos } from '@smartresidence/api-client';
import type { Visitor, VisitorAdminFilter, VisitorListView } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

type AdminVisitorRow = Visitor & {
  unit?: { identifier: string } | null;
  host?: { name: string } | null;
};

type AdminTab = 'live' | 'history';
type LiveFilter = 'all' | VisitorAdminFilter;

const TAB_ITEMS: { id: AdminTab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'history', label: 'Logs' },
];

const LIVE_FILTERS: { id: LiveFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overnight_pending', label: 'Overnight pending' },
  { id: 'urgent_overnight', label: 'Urgent overnight' },
  { id: 'holiday_review', label: 'Holiday review' },
];

export default function AdminVisitorsPage() {
  const [tab, setTab] = useState<AdminTab>('live');
  const [liveFilter, setLiveFilter] = useState<LiveFilter>('all');
  const approveOvernight = useApproveOvernightVisitor(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const view: VisitorListView = tab === 'live' ? 'upcoming' : 'history';
  const filter = tab === 'live' && liveFilter !== 'all' ? liveFilter : undefined;
  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id, view, filter) : ['visitors', 'condo', null],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, { view, filter })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  async function onApproveOvernight(id: string) {
    try {
      await approveOvernight.mutateAsync(id);
      toast.success('Overnight visit approved — pass issued');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Visitors</h1>
        <p className="sr-muted">Live visitor log across the condo.</p>
      </header>

      <PillTabs items={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Visitor admin views" />

      {tab === 'live' ? (
        <PillTabs
          items={LIVE_FILTERS}
          value={liveFilter}
          onChange={setLiveFilter}
          ariaLabel="Overnight management filters"
        />
      ) : null}

      {visitors.isLoading ? (
        <Skeleton className="h-40" />
      ) : (visitors.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={tab === 'live' ? 'No active visitors' : 'No historical records'}
          description={
            tab === 'live'
              ? 'Approved passes, pending walk-ins, and overnight approvals appear here.'
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
                <th>Flags</th>
                <th>Status</th>
                <th />
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
                    <div className="flex flex-wrap gap-1">
                      {v.overnight ? <Badge tone="neutral">Overnight</Badge> : null}
                      {v.urgentOvernight ? <Badge tone="warning">Urgent</Badge> : null}
                      {v.pendingManagementReview ? (
                        <Badge tone="primary">Holiday review</Badge>
                      ) : null}
                      {v.entryMode === 'DRIVE_IN' ? <Badge tone="neutral">Drive</Badge> : null}
                    </div>
                    {v.urgentReason ? (
                      <p className="text-xs sr-muted mt-1 max-w-xs">{v.urgentReason}</p>
                    ) : null}
                  </td>
                  <td>
                    <Badge
                      tone={
                        v.status === 'CHECKED_IN'
                          ? 'success'
                          : v.status === 'CANCELLED' ||
                              v.status === 'REJECTED' ||
                              v.status === 'EXPIRED'
                            ? 'danger'
                            : v.status === 'PENDING_MANAGEMENT_APPROVAL'
                              ? 'warning'
                              : 'primary'
                      }
                    >
                      {v.status.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {v.status === 'PENDING_MANAGEMENT_APPROVAL' && v.overnight ? (
                      <Button
                        size="sm"
                        onClick={() => onApproveOvernight(v.id)}
                        disabled={approveOvernight.isPending}
                      >
                        Approve
                      </Button>
                    ) : null}
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
