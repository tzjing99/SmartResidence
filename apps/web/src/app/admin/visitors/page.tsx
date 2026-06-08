'use client';

import { PillTabs } from '@/components/pill-tabs';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  queryKeys,
  useApproveOvernightVisitor,
  useFlagPlateMismatch,
  useMyCondos,
  useOvernightUnitSummary,
  useSuspendUnitOvernight,
  useUnsuspendUnitOvernight,
} from '@smartresidence/api-client';
import type {
  OvernightUnitSummary,
  Visitor,
  VisitorAdminFilter,
  VisitorListView,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

type AdminVisitorRow = Visitor & {
  unit?: { identifier: string } | null;
  host?: { name: string } | null;
  vehiclePlate?: string | null;
  plateMismatchFlagged?: boolean;
};

type AdminTab = 'live' | 'history' | 'overnight';
type LiveFilter = 'all' | VisitorAdminFilter;

export default function AdminVisitorsPage() {
  const t = useT();
  const TAB_ITEMS: { id: AdminTab; label: string }[] = [
    { id: 'live', label: t('visitors.admin.tabs.live') },
    { id: 'history', label: t('visitors.admin.tabs.history') },
    { id: 'overnight', label: t('visitors.admin.tabs.overnight') },
  ];
  const LIVE_FILTERS: { id: LiveFilter; label: string }[] = [
    { id: 'all', label: t('visitors.admin.filters.all') },
    { id: 'overnight_pending', label: t('visitors.admin.filters.overnightPending') },
    { id: 'urgent_overnight', label: t('visitors.admin.filters.urgentOvernight') },
    { id: 'holiday_review', label: t('visitors.admin.filters.holidayReview') },
  ];
  const [tab, setTab] = useState<AdminTab>('live');
  const [liveFilter, setLiveFilter] = useState<LiveFilter>('all');
  const [suspendUnit, setSuspendUnit] = useState<OvernightUnitSummary | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [suspendIndefinite, setSuspendIndefinite] = useState(true);

  const approveOvernight = useApproveOvernightVisitor(api);
  const flagMismatch = useFlagPlateMismatch(api);
  const suspendUnitMutation = useSuspendUnitOvernight(api);
  const unsuspendUnitMutation = useUnsuspendUnitOvernight(api);
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
    enabled: Boolean(condo) && tab !== 'overnight',
  });
  const overnightSummary = useOvernightUnitSummary(
    api,
    tab === 'overnight' ? (condo?.id ?? null) : null,
  );

  async function onApproveOvernight(id: string) {
    try {
      await approveOvernight.mutateAsync(id);
      toast.success('Overnight visit approved — pass issued');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onFlagMismatch(visitorId: string) {
    const reason = window.prompt('Mismatch reason (optional)') ?? undefined;
    try {
      await flagMismatch.mutateAsync({ visitorId, reason, suspendOwner: true });
      toast.success('Plate mismatch flagged — unit overnight suspended');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onConfirmSuspend() {
    if (!condo || !suspendUnit || suspendReason.trim().length < 3) {
      toast.error('A reason of at least 3 characters is required');
      return;
    }
    try {
      await suspendUnitMutation.mutateAsync({
        condoId: condo.id,
        unitId: suspendUnit.unitId,
        reason: suspendReason.trim(),
        indefinite: suspendIndefinite,
        until: suspendIndefinite ? undefined : suspendUntil || undefined,
      });
      toast.success('Unit overnight registration suspended — owners notified');
      setSuspendUnit(null);
      setSuspendReason('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onUnsuspend(unitId: string) {
    if (!condo) return;
    try {
      await unsuspendUnitMutation.mutateAsync({ condoId: condo.id, unitId });
      toast.success('Overnight registration restored');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('visitors.admin.title')}</h1>
          <p className="sr-muted">{t('visitors.admin.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/admin/settings/visitors">Visitor settings</Link>
        </Button>
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

      {tab === 'overnight' ? (
        overnightSummary.isLoading ? (
          <Skeleton className="h-48" />
        ) : (overnightSummary.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No units" description="No units found for overnight summary." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-left text-xs uppercase sr-muted sticky top-0 bg-[rgb(var(--sr-card))]">
                <tr>
                  <th className="py-3 px-3">{t('visitors.admin.overnightTable.unit')}</th>
                  <th className="px-3 py-3">{t('visitors.admin.overnightTable.owners')}</th>
                  <th className="px-3 py-3">{t('visitors.admin.overnightTable.thisMonth')}</th>
                  <th className="px-3 py-3">{t('visitors.admin.overnightTable.status')}</th>
                  <th className="px-3 py-3 text-right">
                    {t('visitors.admin.overnightTable.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--sr-border))]">
                {overnightSummary.data?.items.map((row, idx) => (
                  <tr
                    key={row.unitId}
                    className={idx % 2 === 1 ? 'bg-[rgb(var(--sr-bg))]/40' : undefined}
                  >
                    <td className="py-3 px-3 font-medium whitespace-nowrap">
                      {row.unitIdentifier}
                    </td>
                    <td className="px-3 sr-muted text-sm leading-relaxed min-w-[10rem]">
                      {row.owners.map((o) => (
                        <span key={o.id} className="block">
                          {o.name}
                          {o.isPrimary ? ' (primary)' : ''}
                        </span>
                      ))}
                    </td>
                    <td className="px-3">
                      {row.overnightCountThisMonth} / {row.monthlyLimit}
                    </td>
                    <td className="px-3">
                      {row.status === 'suspended' ? (
                        <Badge tone="danger">Suspended</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                      {row.suspendReason ? (
                        <p className="text-xs sr-muted mt-1 max-w-xs">{row.suspendReason}</p>
                      ) : null}
                    </td>
                    <td className="px-3 text-right space-x-2">
                      {row.status === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onUnsuspend(row.unitId)}
                          disabled={unsuspendUnitMutation.isPending}
                        >
                          Unsuspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setSuspendUnit(row)}>
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : visitors.isLoading ? (
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
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-left text-xs uppercase sr-muted">
              <tr>
                <th className="py-2 px-3">Visitor</th>
                <th className="px-3">Unit</th>
                <th className="px-3">Host</th>
                <th className="px-3">{tab === 'live' ? 'Expected' : 'Visit date'}</th>
                <th className="px-3">Flags</th>
                <th className="px-3">Status</th>
                <th className="px-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(visitors.data?.items as AdminVisitorRow[]).map((v) => (
                <tr key={v.id}>
                  <td className="py-3 px-3 font-medium">{v.name}</td>
                  <td className="px-3">{v.unit?.identifier ?? '—'}</td>
                  <td className="px-3 sr-muted">{v.host?.name ?? '—'}</td>
                  <td className="px-3 sr-muted">{new Date(v.expectedAt).toLocaleString()}</td>
                  <td className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {v.overnight ? <Badge tone="neutral">Overnight</Badge> : null}
                      {v.urgentOvernight ? <Badge tone="warning">Urgent</Badge> : null}
                      {v.pendingManagementReview ? (
                        <Badge tone="primary">Holiday review</Badge>
                      ) : null}
                      {v.entryMode === 'DRIVE_IN' ? <Badge tone="neutral">Drive</Badge> : null}
                      {v.plateMismatchFlagged ? <Badge tone="danger">Plate mismatch</Badge> : null}
                    </div>
                    {v.urgentReason ? (
                      <p className="text-xs sr-muted mt-1 max-w-xs">{v.urgentReason}</p>
                    ) : null}
                    {v.vehiclePlate ? (
                      <p className="text-xs sr-muted mt-1">Plate: {v.vehiclePlate}</p>
                    ) : null}
                  </td>
                  <td className="px-3">
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
                  <td className="px-3 text-right space-x-2">
                    {v.status === 'PENDING_MANAGEMENT_APPROVAL' && v.overnight ? (
                      <Button
                        size="sm"
                        onClick={() => onApproveOvernight(v.id)}
                        disabled={approveOvernight.isPending}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {v.overnight && v.vehiclePlate && !v.plateMismatchFlagged ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onFlagMismatch(v.id)}
                        disabled={flagMismatch.isPending}
                      >
                        Flag mismatch
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {suspendUnit ? (
        <Card className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50 p-4 shadow-lg border">
          <h3 className="font-semibold mb-3">Suspend {suspendUnit.unitIdentifier}</h3>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="reason">Reason (required)</Label>
              <Input
                id="reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Repeated plate mismatches"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={suspendIndefinite}
                onChange={(e) => setSuspendIndefinite(e.target.checked)}
              />
              Until lifted by management
            </label>
            {!suspendIndefinite ? (
              <div>
                <Label htmlFor="until">Until date</Label>
                <Input
                  id="until"
                  type="date"
                  value={suspendUntil}
                  onChange={(e) => setSuspendUntil(e.target.value)}
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSuspendUnit(null)}>
                Cancel
              </Button>
              <Button onClick={onConfirmSuspend} disabled={suspendUnitMutation.isPending}>
                Suspend
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
