'use client';

import { AuthImage } from '@/components/auth-image';
import {
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUS_FLOW,
  DEFECT_STATUS_LABELS,
  type DefectSeverity,
  type DefectStatus,
} from '@smartresidence/shared-types';
import { Badge, cn } from '@smartresidence/ui-web';
import { Check, Lock, MessageSquare } from 'lucide-react';

const SEVERITY_TONE: Record<DefectSeverity, 'neutral' | 'primary' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

const STATUS_TONE: Record<DefectStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'danger'> =
  {
    NEW: 'primary',
    ACK: 'primary',
    ASSIGNED: 'warning',
    IN_PROGRESS: 'warning',
    RESOLVED: 'success',
    CLOSED: 'success',
    REOPENED: 'danger',
  };

export function DefectSeverityBadge({ severity }: { severity: DefectSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity] ?? 'neutral'}>{DEFECT_SEVERITY_LABELS[severity]}</Badge>;
}

export function DefectStatusBadge({ status }: { status: DefectStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{DEFECT_STATUS_LABELS[status]}</Badge>;
}

interface DefectUpdate {
  id: string;
  message: string;
  statusFrom?: DefectStatus | null;
  statusTo?: DefectStatus | null;
  isInternal?: boolean;
  createdAt: string;
  author?: { name?: string | null } | null;
  attachments?: Array<{ id: string; fileName?: string | null }>;
}

/** Milestone progress bar following the standard lifecycle. */
export function DefectStatusTimeline({
  status,
  updates,
}: {
  status: DefectStatus;
  updates: DefectUpdate[];
}) {
  const reopened = status === 'REOPENED';
  const currentIndex = reopened
    ? DEFECT_STATUS_FLOW.indexOf('ASSIGNED')
    : DEFECT_STATUS_FLOW.indexOf(status);

  const timestampFor = (step: DefectStatus): string | null => {
    const entry = updates.find((u) => u.statusTo === step);
    return entry ? entry.createdAt : null;
  };

  return (
    <ol className="flex flex-col gap-0">
      {DEFECT_STATUS_FLOW.map((step, idx) => {
        const done = idx < currentIndex || (idx === currentIndex && currentIndex >= 0);
        const isCurrent = idx === currentIndex;
        const ts = timestampFor(step);
        const last = idx === DEFECT_STATUS_FLOW.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                  done
                    ? 'border-transparent bg-[rgb(var(--sr-coral))] text-white'
                    : 'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] text-[rgb(var(--sr-muted))]',
                )}
              >
                {done ? <Check className="size-4" /> : idx + 1}
              </span>
              {!last ? (
                <span
                  className={cn(
                    'w-px flex-1 min-h-6',
                    idx < currentIndex
                      ? 'bg-[rgb(var(--sr-coral))]'
                      : 'bg-[rgb(var(--sr-border))]',
                  )}
                />
              ) : null}
            </div>
            <div className={cn('pb-5', last && 'pb-0')}>
              <div
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-[rgb(var(--sr-coral))]' : !done && 'sr-muted',
                )}
              >
                {DEFECT_STATUS_LABELS[step]}
                {isCurrent && reopened ? ' · reopened' : ''}
              </div>
              {ts ? (
                <div className="text-xs sr-muted mt-0.5">
                  {new Date(ts).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DefectPhotos({
  attachments,
  emptyHint,
}: {
  attachments: Array<{ id: string; fileName?: string | null }>;
  emptyHint?: string;
}) {
  if (!attachments.length) {
    return emptyHint ? <p className="text-sm sr-muted">{emptyHint}</p> : null;
  }
  return (
    <div
      className={cn(
        'grid gap-2',
        attachments.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 max-w-sm',
      )}
    >
      {attachments.map((a) => (
        <AuthImage
          key={a.id}
          attachmentId={a.id}
          variant={attachments.length === 1 ? 'raw' : 'thumb'}
          alt={a.fileName ?? 'Defect photo'}
          className="aspect-[4/3] w-full rounded-xl"
        />
      ))}
    </div>
  );
}

/**
 * Chronological activity feed: status changes + comments. When `showInternal`
 * is false (resident view), management-only notes are hidden.
 */
export function DefectActivityFeed({
  updates,
  showInternal,
}: {
  updates: DefectUpdate[];
  showInternal: boolean;
}) {
  const visible = updates.filter((u) => showInternal || !u.isInternal);
  if (!visible.length) {
    return <p className="text-sm sr-muted">No activity yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {visible.map((u) => {
        const isStatusChange = Boolean(u.statusTo);
        return (
          <li
            key={u.id}
            className={cn(
              'rounded-xl border border-[rgb(var(--sr-border))] p-3.5',
              u.isInternal
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-[rgb(var(--sr-bg))]/50',
            )}
          >
            <div className="flex items-center gap-2 text-xs sr-muted">
              {u.isInternal ? (
                <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
              ) : (
                <MessageSquare className="size-3.5" />
              )}
              <span className="font-medium text-[rgb(var(--sr-fg))]">
                {u.author?.name ?? 'System'}
              </span>
              {u.isInternal ? (
                <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                  Internal
                </Badge>
              ) : null}
              <span>·</span>
              <span>{new Date(u.createdAt).toLocaleString()}</span>
            </div>
            {isStatusChange && u.statusFrom ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <DefectStatusBadge status={u.statusFrom} />
                <span className="sr-muted">→</span>
                <DefectStatusBadge status={u.statusTo as DefectStatus} />
              </div>
            ) : null}
            <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{u.message}</p>
            {u.attachments?.length ? (
              <div className="mt-3">
                <DefectPhotos attachments={u.attachments} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
