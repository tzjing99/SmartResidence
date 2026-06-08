'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { formatTimeOnSite } from '@/lib/format-time-on-site';
import { useGuardLiveVisitors, useMyCondos } from '@smartresidence/api-client';
import type { GuardLiveVisitor } from '@smartresidence/shared-types';
import { Badge, Card, EmptyState, Skeleton, cn } from '@smartresidence/ui-web';
import { AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import * as React from 'react';

const GuardLiveVisitorDetail = dynamic(
  () =>
    import('@/components/guard-live-visitor-detail').then((m) => ({
      default: m.GuardLiveVisitorDetail,
    })),
  { ssr: false },
);

function visitTypeLabel(
  visitType: GuardLiveVisitor['visitType'],
  t: ReturnType<typeof useT>,
): string {
  switch (visitType) {
    case 'PRE_REG':
      return t('visitors.guard.visitTypePreReg');
    case 'WALKIN_UNIT':
      return t('visitors.guard.visitTypeWalkInUnit');
    case 'WALKIN_OFFICE':
      return t('visitors.guard.visitTypeWalkInOffice');
    default:
      return visitType;
  }
}

function LiveVisitorCard({
  visitor,
  selected,
  onSelect,
}: {
  visitor: GuardLiveVisitor;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const checkedInAt = new Date(visitor.checkedInAt);
  const duration = formatTimeOnSite(checkedInAt);
  const justIn = Date.now() - checkedInAt.getTime() < 60_000;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group text-left rounded-2xl border p-4 transition-all',
        'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-surface))]',
        'hover:border-coral-500/40 hover:shadow-sm',
        selected && 'ring-2 ring-coral-500/50 border-coral-500/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
              aria-hidden
            />
            <span className="font-semibold truncate">{visitor.name}</span>
          </div>
          <p className="text-sm sr-muted mt-1 truncate">{visitor.unitLabel ?? '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums tracking-tight text-coral-600">
            {justIn ? t('visitors.guard.justCheckedIn') : duration}
          </p>
          {!justIn ? (
            <p className="text-[10px] uppercase tracking-wide sr-muted">
              {t('visitors.guard.onSiteShort')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="neutral" className="text-[10px]">
          {visitTypeLabel(visitor.visitType, t)}
        </Badge>
        {visitor.overnight ? (
          <Badge tone="warning" className="text-[10px]">
            {t('visitors.guard.overnightBadge')}
          </Badge>
        ) : null}
        {visitor.vehiclePlate ? (
          <Badge tone="neutral" className="text-[10px] font-mono">
            {visitor.vehiclePlate}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

export function GuardLiveBoard() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const live = useGuardLiveVisitors(api, condo?.id);
  const [selected, setSelected] = React.useState<GuardLiveVisitor | null>(null);

  const items = live.data?.items ?? [];
  const total = live.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('visitors.guard.liveTitle')}</h1>
        <p className="sr-muted mt-1">{t('visitors.guard.liveBlurb')}</p>
      </header>

      <Card className="relative overflow-hidden border-[rgb(var(--sr-border))] bg-gradient-to-br from-[rgb(var(--sr-surface))] to-[rgb(var(--sr-bg))]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        <div className="relative px-6 py-8 text-center">
          <p className="text-6xl sm:text-7xl font-bold tabular-nums tracking-tighter text-coral-500">
            {live.isLoading ? '—' : total}
          </p>
          <p className="mt-2 text-sm font-medium sr-muted uppercase tracking-widest">
            {t('visitors.guard.liveCount')}
          </p>
        </div>
      </Card>

      {live.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('visitors.guard.liveEmpty')}
          description={t('visitors.guard.liveEmptyHint')}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((visitor) => (
            <LiveVisitorCard
              key={visitor.id}
              visitor={visitor}
              selected={selected?.id === visitor.id}
              onSelect={() => setSelected(visitor)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected ? (
          <GuardLiveVisitorDetail
            key={selected.id}
            visitor={selected}
            onClose={() => setSelected(null)}
            onCheckedOut={() => setSelected(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
