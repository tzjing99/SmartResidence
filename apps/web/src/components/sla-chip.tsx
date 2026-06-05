'use client';

import { SLA_LABEL, SLA_TONE, formatTimeLeft, slaDueAt } from '@/lib/thread-ui';
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
 * Unmistakable SLA chip: green "On track", amber "At risk", red "Breached".
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
  const due = slaDueAt({ slaState, firstResponseDueAt, resolutionDueAt });
  const pop =
    slaState === 'BREACHED'
      ? 'ring-1 ring-red-500/40 font-semibold'
      : slaState === 'AT_RISK'
        ? 'ring-1 ring-amber-500/40 font-semibold'
        : '';

  return (
    <Badge
      tone={SLA_TONE[slaState]}
      className={cn(pop, className)}
      title={due ? new Date(due).toLocaleString() : undefined}
      aria-label={`SLA ${SLA_LABEL[slaState]}${due ? `, ${formatTimeLeft(due)}` : ''}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {SLA_LABEL[slaState]}
      {showDetail && due ? <span className="opacity-80">· {formatTimeLeft(due)}</span> : null}
    </Badge>
  );
}
