'use client';

import { useT } from '@/i18n/locale-provider';
import {
  type ArrivalHighlight,
  getVisitorArrivalHighlight,
  minutesUntilArrival,
} from '@/lib/format-arrival-highlight';
import type {
  GuardExpectedVisitor,
  VisitorStatus,
  VisitorVisitType,
} from '@smartresidence/shared-types';
import {
  deliveryPlatformLabel,
  guardCanAcknowledgeWalkIn,
  guardVisitorStatusLabel,
  isQuickEntryPass,
  passKindLabel,
} from '@smartresidence/shared-types';
import { Badge, Button, cn } from '@smartresidence/ui-web';
import * as React from 'react';

function visitTypeLabel(visitType: VisitorVisitType, t: ReturnType<typeof useT>): string {
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

function statusLabel(status: VisitorStatus, _t: ReturnType<typeof useT>): string {
  return guardVisitorStatusLabel(status);
}

function ArrivalChip({
  highlight,
  expectedAt,
}: {
  highlight: ArrivalHighlight;
  expectedAt: Date;
}) {
  const t = useT();
  if (!highlight) return null;

  const minutes = minutesUntilArrival(expectedAt);
  const label =
    highlight === 'overdue'
      ? t('visitors.guard.overdue')
      : minutes <= 1
        ? t('visitors.guard.arrivingSoon')
        : t('visitors.guard.arrivingIn', { minutes });

  return (
    <Badge tone={highlight === 'overdue' ? 'warning' : 'primary'} className="shrink-0">
      {label}
    </Badge>
  );
}

export type GuardExpectedCardVariant = 'expected' | 'no_show' | 'history';

export function GuardExpectedVisitorCard({
  visitor,
  variant,
  onAcknowledgeWalkIn,
  acknowledging,
}: {
  visitor: Pick<
    GuardExpectedVisitor,
    | 'id'
    | 'name'
    | 'expectedAt'
    | 'unitLabel'
    | 'visitType'
    | 'vehiclePlate'
    | 'overnight'
    | 'status'
    | 'passKind'
    | 'deliveryPlatform'
  >;
  variant: GuardExpectedCardVariant;
  onAcknowledgeWalkIn?: (visitorId: string) => void;
  acknowledging?: boolean;
}) {
  const t = useT();
  const canAcknowledge =
    variant === 'expected' && guardCanAcknowledgeWalkIn(visitor) && onAcknowledgeWalkIn;
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const expectedAt = new Date(visitor.expectedAt);

  React.useEffect(() => {
    if (variant !== 'expected') return;
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [variant]);

  const highlight =
    variant === 'expected'
      ? getVisitorArrivalHighlight({
          expectedAt,
          visitType: visitor.visitType,
          status: visitor.status,
        })
      : null;
  const timeLabel = expectedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <article
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        isQuickEntryPass(visitor) && 'border-amber-500/35 bg-amber-500/[0.04]',
        variant === 'no_show'
          ? 'border-[rgb(var(--sr-border))]/60 bg-[rgb(var(--sr-surface))]/60 opacity-90'
          : 'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-surface))]',
        highlight === 'soon' && 'border-coral-500/30 bg-coral-500/[0.03]',
        highlight === 'overdue' && 'border-amber-500/35 bg-amber-500/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {variant === 'expected' ? (
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  highlight === 'overdue'
                    ? 'bg-amber-500'
                    : highlight === 'soon'
                      ? 'bg-coral-500 shadow-[0_0_8px_rgba(255,90,60,0.5)]'
                      : 'bg-[rgb(var(--sr-border))]',
                )}
                aria-hidden
              />
            ) : null}
            <h3 className="font-semibold truncate">{visitor.name}</h3>
            {isQuickEntryPass(visitor) ? (
              <Badge tone="warning" className="shrink-0">
                {visitor.deliveryPlatform
                  ? deliveryPlatformLabel(visitor.deliveryPlatform)
                  : passKindLabel(visitor.passKind ?? 'DELIVERY')}
              </Badge>
            ) : null}
            {visitor.overnight ? (
              <Badge tone="neutral" className="shrink-0">
                {t('visitors.guard.overnightBadge')}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm sr-muted mt-1">{visitor.unitLabel ?? '—'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm font-medium tabular-nums">{timeLabel}</span>
            <span className="text-xs sr-muted">·</span>
            <span className="text-xs sr-muted">{visitTypeLabel(visitor.visitType, t)}</span>
            {visitor.vehiclePlate ? (
              <>
                <span className="text-xs sr-muted">·</span>
                <span className="text-xs font-mono tracking-wide">{visitor.vehiclePlate}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {variant === 'expected' ? (
            <ArrivalChip highlight={highlight} expectedAt={expectedAt} />
          ) : null}
          {variant !== 'expected' ? (
            <Badge tone={variant === 'no_show' ? 'neutral' : 'primary'}>
              {statusLabel(visitor.status, t)}
            </Badge>
          ) : visitor.status !== 'APPROVED' ? (
            <Badge tone={visitor.status === 'PENDING_OWNER_APPROVAL' ? 'warning' : 'neutral'}>
              {statusLabel(visitor.status, t)}
            </Badge>
          ) : null}
        </div>
      </div>
      {canAcknowledge ? (
        <div className="mt-3 pt-3 border-t border-[rgb(var(--sr-border))]">
          <Button
            className="w-full"
            size="sm"
            disabled={acknowledging}
            onClick={() => onAcknowledgeWalkIn?.(visitor.id)}
          >
            {t('visitors.guard.acknowledgeWalkIn')}
          </Button>
          <p className="text-xs sr-muted mt-2 leading-relaxed">
            {t('visitors.guard.acknowledgeWalkInHint')}
          </p>
        </div>
      ) : null}
    </article>
  );
}
