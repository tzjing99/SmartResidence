import type { SlaState, ThreadPriority, ThreadStatus } from '@smartresidence/api-client';

type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'info';

export const PRIORITY_TONE: Record<ThreadPriority, Tone> = {
  LOW: 'success',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const STATUS_TONE: Record<ThreadStatus, Tone> = {
  OPEN: 'primary',
  AWAITING_MANAGEMENT: 'primary',
  AWAITING_RESIDENT: 'warning',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

export const SLA_TONE: Record<SlaState, Tone> = {
  NONE: 'neutral',
  ON_TRACK: 'success',
  AT_RISK: 'warning',
  BREACHED: 'danger',
};

export const SLA_LABEL: Record<Exclude<SlaState, 'NONE'>, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'Needs attention',
  BREACHED: 'Overdue',
};

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  OPEN: 'Open',
  AWAITING_MANAGEMENT: 'In progress',
  AWAITING_RESIDENT: 'Waiting on resident',
  PENDING_RESIDENT_CONFIRMATION: 'Awaiting confirmation',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export const PRIORITY_LABEL: Record<ThreadPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

interface SlaDueShape {
  slaState: SlaState;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
}

export type SlaDueKind = 'firstResponse' | 'resolution';

export interface SlaDueInfo {
  dueAt: string;
  kind: SlaDueKind;
}

/**
 * Pick the SLA due date that the chip should surface: the earliest overdue
 * clock when breached, otherwise the soonest upcoming deadline.
 */
export function slaDueInfo(t: SlaDueShape, now: number = Date.now()): SlaDueInfo | null {
  const entries: SlaDueInfo[] = [];
  if (t.firstResponseDueAt) {
    entries.push({ dueAt: t.firstResponseDueAt, kind: 'firstResponse' });
  }
  if (t.resolutionDueAt) {
    entries.push({ dueAt: t.resolutionDueAt, kind: 'resolution' });
  }
  if (entries.length === 0) return null;

  const byTime = (a: SlaDueInfo, b: SlaDueInfo) =>
    new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();

  if (t.slaState === 'BREACHED') {
    const overdue = entries.filter((e) => new Date(e.dueAt).getTime() < now).sort(byTime);
    return overdue[0] ?? entries.slice().sort(byTime)[0] ?? null;
  }
  const upcoming = entries.filter((e) => new Date(e.dueAt).getTime() >= now).sort(byTime);
  return upcoming[0] ?? entries.slice().sort(byTime)[0] ?? null;
}

/** @deprecated Prefer slaDueInfo when the deadline kind matters. */
export function slaDueAt(t: SlaDueShape, now: number = Date.now()): string | null {
  return slaDueInfo(t, now)?.dueAt ?? null;
}

function formatDuration(absMs: number): string {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < hour) return `${Math.max(1, Math.round(absMs / minute))}m`;
  if (absMs < 2 * day) return `${Math.round(absMs / hour)}h`;
  return `${Math.round(absMs / day)}d`;
}

/** Human-friendly deadline text for reply or resolution clocks. */
export function formatDeadline(dueIso: string, kind: SlaDueKind, now: number = Date.now()): string {
  const diff = new Date(dueIso).getTime() - now;
  const mag = formatDuration(Math.abs(diff));
  if (diff < 0) {
    return kind === 'firstResponse'
      ? `Reply was due ${mag} ago`
      : `Should have been fixed ${mag} ago`;
  }
  return kind === 'firstResponse' ? `Reply due in ${mag}` : `Fix due in ${mag}`;
}

/** Human-friendly "due in 3h" / "2h overdue" relative to now. */
export function formatTimeLeft(dueIso: string, now: number = Date.now()): string {
  const diff = new Date(dueIso).getTime() - now;
  const mag = formatDuration(Math.abs(diff));
  return diff >= 0 ? `due in ${mag}` : `${mag} overdue`;
}

export const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'BILLING', label: 'Billing & fees' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'FACILITY', label: 'Facilities' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'GOVERNANCE', label: 'Governance / AGM' },
  { value: 'GENERAL', label: 'General' },
];

export function statusLabel(status: ThreadStatus): string {
  return STATUS_LABEL[status];
}

export function priorityLabel(priority: ThreadPriority): string {
  return PRIORITY_LABEL[priority];
}

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? prettyLabel(value);
}

export function prettyLabel(value: string): string {
  if (value in STATUS_LABEL) return STATUS_LABEL[value as ThreadStatus];
  if (value in PRIORITY_LABEL) return PRIORITY_LABEL[value as ThreadPriority];
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
