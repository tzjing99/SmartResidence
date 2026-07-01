'use client';

import { GuardExpectedVisitorCard } from '@/components/guard-expected-visitor-card';
import { PillTabs } from '@/components/pill-tabs';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { queryKeys, useGuardAcknowledgeWalkIn, useMyCondos } from '@smartresidence/api-client';
import type { GuardExpectedVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import { EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

type ExpectedTab = 'expected' | 'no_show' | 'history';

const TAB_VIEWS: Record<ExpectedTab, VisitorListView> = {
  expected: 'expected',
  no_show: 'no_show',
  history: 'history',
};

const TAB_IDS: ExpectedTab[] = ['expected', 'no_show', 'history'];

function toCardVisitor(
  v: GuardExpectedVisitor | (Visitor & { unit?: { identifier?: string } }),
): GuardExpectedVisitor {
  if ('unitLabel' in v && v.unitLabel !== undefined) {
    return v as GuardExpectedVisitor;
  }
  const visitor = v as Visitor & { unit?: { identifier?: string } };
  return {
    id: visitor.id,
    name: visitor.name,
    expectedAt: visitor.expectedAt,
    vehiclePlate: visitor.vehiclePlate,
    visitType: visitor.visitType,
    passKind: visitor.passKind,
    deliveryPlatform: visitor.deliveryPlatform,
    status: visitor.status,
    unitLabel: visitor.unit?.identifier ?? null,
    overnight: visitor.overnight,
  };
}

function guardExpectedListKey(condoId: string, view: VisitorListView) {
  return [...queryKeys.condoVisitors(condoId, { view }), 'guard-expected'] as const;
}

export default function GuardExpectedPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ExpectedTab>('expected');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const activeView = TAB_VIEWS[tab];

  const counts = useQueries({
    queries: TAB_IDS.map((id) => ({
      queryKey: condo
        ? [...queryKeys.condoVisitors(condo.id, { view: TAB_VIEWS[id] }), 'guard-expected-count']
        : ['visitors', 'condo', null, id],
      queryFn: () =>
        condo
          ? api.visitorsForCondo(condo.id, { view: TAB_VIEWS[id], limit: 1 })
          : Promise.resolve({ items: [], total: 0 }),
      enabled: Boolean(condo),
      staleTime: 30_000,
    })),
  });

  const activeVisitors = useQuery({
    queryKey: condo ? guardExpectedListKey(condo.id, activeView) : ['visitors', 'condo', null, tab],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, { view: activeView, limit: 50 })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
    staleTime: 30_000,
    refetchInterval: tab === 'expected' ? 30_000 : false,
  });
  const acknowledgeWalkIn = useGuardAcknowledgeWalkIn(api);

  async function onAcknowledgeWalkIn(visitorId: string, name: string) {
    try {
      await acknowledgeWalkIn.mutateAsync(visitorId);
      toast.success(t('visitors.guard.acknowledgeWalkInSuccess', { name }));
      if (condo) {
        await qc.invalidateQueries({ queryKey: ['visitors'] });
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const prefetchTab = useCallback(
    (nextTab: ExpectedTab) => {
      if (!condo || nextTab === tab) return;
      const view = TAB_VIEWS[nextTab];
      void qc.prefetchQuery({
        queryKey: guardExpectedListKey(condo.id, view),
        queryFn: () => api.visitorsForCondo(condo.id, { view, limit: 50 }),
        staleTime: 30_000,
      });
    },
    [condo, qc, tab],
  );

  const handleTabChange = useCallback(
    (nextTab: ExpectedTab) => {
      prefetchTab(nextTab);
      setTab(nextTab);
    },
    [prefetchTab],
  );

  const items = (activeVisitors.data?.items ?? []) as Array<
    GuardExpectedVisitor | (Visitor & { unit?: { identifier?: string } })
  >;

  const TAB_ITEMS = useMemo(
    () =>
      TAB_IDS.map((id, i) => {
        const count = counts[i]?.data?.total ?? 0;
        const base =
          id === 'expected'
            ? t('visitors.guard.tabs.expected')
            : id === 'no_show'
              ? t('visitors.guard.tabs.noShow')
              : t('visitors.guard.tabs.history');
        return {
          id,
          label: count > 0 ? `${base} (${count})` : base,
        };
      }),
    [t, counts],
  );

  const emptyTitle =
    tab === 'history'
      ? t('visitors.guard.emptyHistory')
      : tab === 'no_show'
        ? t('visitors.guard.emptyNoShow')
        : t('visitors.guard.emptyExpected');

  const emptyDescription =
    tab === 'expected'
      ? t('visitors.guard.emptyExpectedHint')
      : tab === 'no_show'
        ? t('visitors.guard.emptyNoShowHint')
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('visitors.guard.expectedTitle')}</h1>
        <p className="sr-muted mt-1 max-w-2xl">{t('visitors.guard.expectedBlurbShort')}</p>
      </header>

      <PillTabs
        items={TAB_ITEMS}
        value={tab}
        onChange={handleTabChange}
        ariaLabel={t('visitors.guard.expectedTabsAria')}
      />

      {activeVisitors.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((v) => (
            <GuardExpectedVisitorCard
              key={v.id}
              visitor={toCardVisitor(v)}
              variant={tab === 'history' ? 'history' : tab}
              onAcknowledgeWalkIn={(id) => void onAcknowledgeWalkIn(id, v.name)}
              acknowledging={acknowledgeWalkIn.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
