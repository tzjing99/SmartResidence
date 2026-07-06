'use client';

import { useT } from '@/i18n/locale-provider';
import { SLA_TONE, formatDeadline, slaDueInfo, slaLabel } from '@/lib/thread-ui';
import type { SlaState } from '@smartresidence/api-client';
import { Badge, cn } from '@smartresidence/ui-web';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import * as React from 'react';

interface SlaChipProps {
  slaState: SlaState;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  showDetail?: boolean;
  className?: string;
}

const ICONS: Record<Exclude<SlaState, 'NONE'>, React.ComponentType<{ className?: string }>> = {
  ON_TRACK: CheckCircle2,
  AT_RISK: Clock,
  BREACHED: AlertTriangle,
};

export function SlaChip({
  slaState,
  firstResponseDueAt,
  resolutionDueAt,
  showDetail = true,
  className,
}: SlaChipProps) {
  const t = useT();
  if (slaState === 'NONE') return null;
  const Icon = ICONS[slaState];
  const due = slaDueInfo({ slaState, firstResponseDueAt, resolutionDueAt });
  const dueText = due ? formatDeadline(t, due.dueAt, due.kind) : null;
  const pop =
    slaState === 'BREACHED'
      ? 'font-semibold shadow-sm'
      : slaState === 'AT_RISK'
        ? 'font-medium'
        : '';

  const stateLabel = slaLabel(t, slaState);
  const label = `${t('helpdesk.sla.chipPrefix')} ${stateLabel}${dueText ? `, ${dueText}` : ''}`;
  const title = due ? new Date(due.dueAt).toLocaleString() : undefined;

  const badge = (
    <Badge tone={SLA_TONE[slaState]} className={cn(pop, 'self-start shrink-0')}>
      <Icon className="size-3.5" aria-hidden />
      {stateLabel}
    </Badge>
  );

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
