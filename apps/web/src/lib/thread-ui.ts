import type { SlaState, ThreadPriority, ThreadStatus } from '@smartresidence/api-client';

type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'info';

export const PRIORITY_TONE: Record<ThreadPriority, Tone> = {
  LOW: 'neutral',
  NORMAL: 'primary',
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
  AT_RISK: 'At risk',
  BREACHED: 'Breached',
};

interface SlaDueShape {
  slaState: SlaState;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
}

/**
 * Pick the SLA due date that the chip should surface: the earliest overdue
 * clock when breached, otherwise the soonest upcoming deadline.
 */
export function slaDueAt(t: SlaDueShape, now: number = Date.now()): string | null {
  const dues = [t.firstResponseDueAt, t.resolutionDueAt].filter((d): d is string => Boolean(d));
  if (dues.length === 0) return null;
  const byTime = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
  const sorted = dues.slice().sort(byTime);
  if (t.slaState === 'BREACHED') {
    const overdue = dues.filter((d) => new Date(d).getTime() < now).sort(byTime);
    return overdue[0] ?? sorted[0] ?? null;
  }
  const upcoming = dues.filter((d) => new Date(d).getTime() >= now).sort(byTime);
  return upcoming[0] ?? sorted[0] ?? null;
}

/** Human-friendly "due in 3h" / "2h overdue" relative to now. */
export function formatTimeLeft(dueIso: string, now: number = Date.now()): string {
  const diff = new Date(dueIso).getTime() - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let mag: string;
  if (abs < hour) mag = `${Math.max(1, Math.round(abs / minute))}m`;
  else if (abs < 2 * day) mag = `${Math.round(abs / hour)}h`;
  else mag = `${Math.round(abs / day)}d`;
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

export function prettyLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ');
}
