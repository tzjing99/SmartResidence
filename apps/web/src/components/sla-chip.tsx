'use client';

import { SLA_LABEL, SLA_TONE, formatDeadline, slaDueInfo } from '@/lib/thread-ui';
import type { SlaState } from '@smartresidence/api-client';
import { Badge, cn } from '@smartresidence/ui-web';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import * as React from 'react';

interface SlaChipProps {
  slaState: SlaState;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  /** Show the relative due time alongside the label. */
  showDetail?: boolean;
  className?: string;
}

const ICONS: Record<Exclude<SlaState, 'NONE'>, React.ComponentType<{ className?: string }>> = {
  ON_TRACK: CheckCircle2,
  AT_RISK: Clock,
  BREACHED: AlertTriangle,
};

/**
 * Unmistakable SLA chip: green "On track", amber "Needs attention", red "Overdue".
 * Breached/at-risk are made to visually pop (ring + stronger weight) and the
 * actual time remaining / overdue amount is surfaced.
 */
export function SlaChip({
  slaState,
  firstResponseDueAt,
  resolutionDueAt,
  showDetail = true,
  className,
}: SlaChipProps) {
  if (slaState === 'NONE') return null;
  const Icon = ICONS[slaState];
  const due = slaDueInfo({ slaState, firstResponseDueAt, resolutionDueAt });
  const dueText = due ? formatDeadline(due.dueAt, due.kind) : null;
  const pop =
    slaState === 'BREACHED'
      ? 'font-semibold shadow-sm'
      : slaState === 'AT_RISK'
        ? 'font-medium'
        : '';

  const label = `SLA ${SLA_LABEL[slaState]}${dueText ? `, ${dueText}` : ''}`;
  const title = due ? new Date(due.dueAt).toLocaleString() : undefined;

  const badge = (
    <Badge tone={SLA_TONE[slaState]} className={cn(pop, 'self-start shrink-0')}>
      <Icon className="size-3.5" aria-hidden />
      {SLA_LABEL[slaState]}
    </Badge>
  );

  // Stack label + due time so long copy (e.g. "Reply was due 3d ago") doesn't overflow the pill.
  if (showDetail && dueText) {
    return (
      <div
        className={cn('flex min-w-0 max-w-full flex-col gap-0.5', className)}
        title={title}
        aria-label={label}
      >
        {badge}
        <span className="text-[11px] leading-snug sr-muted truncate">{dueText}</span>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex min-w-0', className)} title={title} aria-label={label}>
      {badge}
    </span>
  );
}
