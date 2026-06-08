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
  useVisitorAdminStats,
} from '@smartresidence/api-client';
import type { Visitor, VisitorListView, VisitorStatus } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Skeleton, cn } from '@smartresidence/ui-web';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  Flag,
  Moon,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type AdminTab = 'active' | 'history';

type AdminVisitorRow = Visitor & {
  unit?: { identifier: string } | null;
  host?: { name: string } | null;
  vehiclePlate?: string | null;
  plateMismatchFlagged?: boolean;
};

const PAGE_SIZE = 20;

const STATUS_OPTIONS: VisitorStatus[] = [
  'PENDING_OWNER_APPROVAL',
  'PENDING_MANAGEMENT_APPROVAL',
  'APPROVED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'EXPIRED',
  'REJECTED',
  'CANCELLED',
];

function statusTone(status: VisitorStatus) {
  if (status === 'CHECKED_IN') return 'success' as const;
  if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED')
    return 'danger' as const;
  if (status === 'PENDING_MANAGEMENT_APPROVAL' || status === 'PENDING_OWNER_APPROVAL') {
    return 'warning' as const;
  }
  if (status === 'CHECKED_OUT') return 'neutral' as const;
  return 'primary' as const;
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <Card
      className={cn(
        'p-4 min-h-[5.5rem] flex flex-col justify-between',
        highlight && value > 0 && 'border-coral-500/30 bg-coral-500/[0.04]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm sr-muted leading-snug">{label}</span>
        <Icon className="size-4 shrink-0 sr-muted opacity-70" aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-14 mt-2" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums tracking-tight mt-1">{value}</p>
      )}
    </Card>
  );
}

export default function AdminVisitorsPage() {
  const t = useT();
  const [tab, setTab] = React.useState<AdminTab>('active');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status, setStatus] = React.useState<VisitorStatus | ''>('');
  const [unitId, setUnitId] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [offset, setOffset] = React.useState(0);

  const TAB_ITEMS: { id: AdminTab; label: string }[] = [
    { id: 'active', label: t('visitors.admin.tabs.active') },
    { id: 'history', label: t('visitors.admin.tabs.history') },
  ];

  const resetPage = React.useCallback(() => setOffset(0), []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      resetPage();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, resetPage]);

  const approveOvernight = useApproveOvernightVisitor(api);
  const flagMismatch = useFlagPlateMismatch(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  const view: VisitorListView = tab === 'active' ? 'active' : 'history';
  const listParams = {
    view,
    search: debouncedSearch || undefined,
    status: status || undefined,
    unitId: unitId || undefined,
    from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id, listParams) : ['visitors', 'condo', null],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, listParams)
        : Promise.resolve({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 }),
    enabled: Boolean(condo),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const stats = useVisitorAdminStats(api, condo?.id ?? null);

  const units = useQuery({
    queryKey: ['admin', 'units', condo?.id, 'visitor-filter'],
    queryFn: () =>
      condo ? api.listUnits(condo.id, { limit: 200 }) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
    staleTime: 60_000,
  });

  const items = (visitors.data?.items ?? []) as AdminVisitorRow[];
  const hasManagementActions = items.some(
    (v) =>
      (v.status === 'PENDING_MANAGEMENT_APPROVAL' && v.overnight) ||
      (v.overnight && v.vehiclePlate && !v.plateMismatchFlagged),
  );
  const total = visitors.data?.total ?? 0;
  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, total);
  const hasFilters = Boolean(debouncedSearch || status || unitId || fromDate || toDate);

  async function onApproveOvernight(id: string) {
    try {
      await approveOvernight.mutateAsync(id);
      toast.success(t('visitors.admin.actions.approveSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onFlagMismatch(visitorId: string) {
    const reason = window.prompt(t('visitors.admin.actions.flagPrompt')) ?? undefined;
    try {
      await flagMismatch.mutateAsync({ visitorId, reason, suspendOwner: true });
      toast.success(t('visitors.admin.actions.flagSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const statItems = [
    {
      key: 'onSite',
      label: t('visitors.admin.stats.onSite'),
      value: stats.data?.onSiteCount ?? 0,
      icon: Users,
    },
    {
      key: 'expectedToday',
      label: t('visitors.admin.stats.expectedToday'),
      value: stats.data?.expectedToday ?? 0,
      icon: CalendarClock,
    },
    {
      key: 'checkInsToday',
      label: t('visitors.admin.stats.checkInsToday'),
      value: stats.data?.checkInsToday ?? 0,
      icon: DoorOpen,
    },
    {
      key: 'walkInsToday',
      label: t('visitors.admin.stats.walkInsToday'),
      value: stats.data?.walkInsToday ?? 0,
      icon: ClipboardList,
    },
    {
      key: 'pendingOvernight',
      label: t('visitors.admin.stats.pendingOvernight'),
      value: stats.data?.pendingOvernight ?? 0,
      icon: Moon,
      highlight: true,
    },
    {
      key: 'pendingOwner',
      label: t('visitors.admin.stats.pendingOwner'),
      value: stats.data?.pendingOwnerApproval ?? 0,
      icon: UserCheck,
      highlight: true,
    },
  ] as const;

  const selectCls = 'sr-select w-auto min-w-[9rem]';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('visitors.admin.title')}</h1>
          <p className="sr-muted mt-1">{t('visitors.admin.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/admin/settings/visitors">{t('visitors.admin.settingsLink')}</Link>
        </Button>
      </header>

      <section
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        aria-label="Visitor insights"
      >
        {statItems.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={item.value}
            icon={item.icon}
            highlight={'highlight' in item && item.highlight}
            loading={stats.isLoading}
          />
        ))}
      </section>

      <Card className="p-4 flex flex-col gap-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 sr-muted pointer-events-none"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder={t('visitors.admin.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('visitors.admin.searchPlaceholder')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label={t('visitors.admin.filters.allStatuses')}
            className={selectCls}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as VisitorStatus | '');
              resetPage();
            }}
          >
            <option value="">{t('visitors.admin.filters.allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`visitors.admin.status.${s}`)}
              </option>
            ))}
          </select>

          <select
            aria-label={t('visitors.admin.filters.allUnits')}
            className={cn(selectCls, 'min-w-[10rem]')}
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              resetPage();
            }}
          >
            <option value="">{t('visitors.admin.filters.allUnits')}</option>
            {(units.data?.items as Array<{ id: string; identifier: string }> | undefined)?.map(
              (u) => (
                <option key={u.id} value={u.id}>
                  {u.identifier}
                </option>
              ),
            )}
          </select>

          <div className="flex items-center gap-2 text-sm sr-muted">
            <label htmlFor="visitor-from-date" className="whitespace-nowrap">
              {t('visitors.admin.filters.fromDate')}
            </label>
            <Input
              id="visitor-from-date"
              type="date"
              className="w-auto"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                resetPage();
              }}
            />
          </div>

          <div className="flex items-center gap-2 text-sm sr-muted">
            <label htmlFor="visitor-to-date" className="whitespace-nowrap">
              {t('visitors.admin.filters.toDate')}
            </label>
            <Input
              id="visitor-to-date"
              type="date"
              className="w-auto"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                resetPage();
              }}
            />
          </div>

          {fromDate || toDate ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromDate('');
                setToDate('');
                resetPage();
              }}
            >
              {t('visitors.admin.filters.clearDates')}
            </Button>
          ) : null}
        </div>

        <PillTabs
          items={TAB_ITEMS}
          value={tab}
          onChange={(id) => {
            setTab(id);
            resetPage();
          }}
          ariaLabel="Visitor log views"
        />
      </Card>

      {visitors.isLoading && !visitors.data ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? t('visitors.admin.empty.filteredTitle')
              : tab === 'active'
                ? t('visitors.admin.empty.activeTitle')
                : t('visitors.admin.empty.historyTitle')
          }
          description={
            hasFilters
              ? t('visitors.admin.empty.filteredDesc')
              : tab === 'active'
                ? t('visitors.admin.empty.activeDesc')
                : t('visitors.admin.empty.historyDesc')
          }
        />
      ) : (
        <>
          <div className="md:hidden flex flex-col gap-3">
            {items.map((v) => {
              const unitLabel =
                v.visitType === 'WALKIN_OFFICE'
                  ? t('visitors.admin.table.office')
                  : (v.unit?.identifier ?? '—');
              const showApprove = v.status === 'PENDING_MANAGEMENT_APPROVAL' && v.overnight;
              const showFlag = v.overnight && v.vehiclePlate && !v.plateMismatchFlagged;

              return (
                <Card key={v.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{v.name}</p>
                      <p className="text-xs sr-muted mt-0.5">
                        {t(`visitors.admin.visitType.${v.visitType}`)} · {unitLabel}
                      </p>
                    </div>
                    <Badge tone={statusTone(v.status)}>
                      {t(`visitors.admin.status.${v.status}`)}
                    </Badge>
                  </div>
                  <div className="text-sm sr-muted">
                    {new Date(v.expectedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                  </div>
                  {showApprove || showFlag ? (
                    <div className="flex flex-wrap gap-2">
                      {showApprove ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onApproveOvernight(v.id)}
                          disabled={approveOvernight.isPending}
                        >
                          <Moon className="size-4" aria-hidden />
                          {t('visitors.admin.actions.approveOvernight')}
                        </Button>
                      ) : null}
                      {showFlag ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onFlagMismatch(v.id)}
                          disabled={flagMismatch.isPending}
                        >
                          <Flag className="size-4" aria-hidden />
                          {t('visitors.admin.actions.flagMismatch')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm sr-muted">
              <span>
                {t('visitors.admin.table.showing', {
                  from: pageFrom,
                  to: pageTo,
                  total,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset === 0 || visitors.isFetching}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  {t('visitors.admin.table.prev')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= total || visitors.isFetching}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  {t('visitors.admin.table.next')}
                </Button>
              </div>
            </div>
          </div>

          <Card className="p-0 overflow-hidden hidden md:block">
            {hasManagementActions ? (
              <p className="px-4 pt-3 pb-1 text-xs sr-muted">
                {t('visitors.admin.table.managementHint')}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="text-left text-xs uppercase sr-muted bg-[rgb(var(--sr-bg))]">
                  <tr>
                    <th className="py-3 px-4">{t('visitors.admin.table.guest')}</th>
                    <th className="px-4 py-3">{t('visitors.admin.table.unit')}</th>
                    <th className="px-4 py-3">{t('visitors.admin.table.when')}</th>
                    <th className="px-4 py-3 text-center">{t('visitors.admin.table.details')}</th>
                    <th className="px-4 py-3">{t('visitors.admin.table.carPlate')}</th>
                    <th className="px-4 py-3">{t('visitors.admin.table.status')}</th>
                    {hasManagementActions ? (
                      <th className="px-4 py-3 text-right">
                        {t('visitors.admin.table.management')}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--sr-border))]">
                  {items.map((v, idx) => {
                    const unitLabel =
                      v.visitType === 'WALKIN_OFFICE'
                        ? t('visitors.admin.table.office')
                        : (v.unit?.identifier ?? '—');
                    const showApprove = v.status === 'PENDING_MANAGEMENT_APPROVAL' && v.overnight;
                    const showFlag = v.overnight && v.vehiclePlate && !v.plateMismatchFlagged;

                    return (
                      <tr
                        key={v.id}
                        className={idx % 2 === 1 ? 'bg-[rgb(var(--sr-bg))]/40' : undefined}
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium">{v.name}</p>
                          <p className="text-xs sr-muted mt-0.5">
                            {t(`visitors.admin.visitType.${v.visitType}`)}
                          </p>
                        </td>
                        <td className="px-4 whitespace-nowrap">{unitLabel}</td>
                        <td className="px-4 sr-muted whitespace-nowrap">
                          {new Date(v.expectedAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 text-center">
                          <div className="inline-flex flex-wrap items-center justify-center gap-1">
                            {v.entryMode === 'DRIVE_IN' ? (
                              <Badge tone="neutral" className="text-[10px]">
                                {t('visitors.admin.badges.driveIn')}
                              </Badge>
                            ) : (
                              <Badge tone="neutral" className="text-[10px]">
                                {t('visitors.admin.table.walkIn')}
                              </Badge>
                            )}
                            {v.plateMismatchFlagged ? (
                              <Badge tone="danger" className="text-[10px]">
                                {t('visitors.admin.badges.plateMismatch')}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 whitespace-nowrap tabular-nums">
                          {v.vehiclePlate ?? t('visitors.admin.table.noPlate')}
                        </td>
                        <td className="px-4">
                          <Badge tone={statusTone(v.status)}>
                            {t(`visitors.admin.status.${v.status}`)}
                          </Badge>
                        </td>
                        {hasManagementActions ? (
                          <td className="px-4 text-right">
                            {showApprove || showFlag ? (
                              <div className="inline-flex justify-end gap-1">
                                {showApprove ? (
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => onApproveOvernight(v.id)}
                                    disabled={approveOvernight.isPending}
                                    aria-label={t('visitors.admin.actions.approveOvernight')}
                                    title={t('visitors.admin.actions.approveOvernight')}
                                  >
                                    <Moon className="size-4" aria-hidden />
                                  </Button>
                                ) : null}
                                {showFlag ? (
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => onFlagMismatch(v.id)}
                                    disabled={flagMismatch.isPending}
                                    aria-label={t('visitors.admin.actions.flagMismatch')}
                                    title={t('visitors.admin.actions.flagMismatch')}
                                  >
                                    <Flag className="size-4" aria-hidden />
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[rgb(var(--sr-border))] text-sm sr-muted">
              <span>
                {t('visitors.admin.table.showing', {
                  from: pageFrom,
                  to: pageTo,
                  total,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset === 0 || visitors.isFetching}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  {t('visitors.admin.table.prev')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= total || visitors.isFetching}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  {t('visitors.admin.table.next')}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
