import type { SlaState, ThreadPriority, ThreadStatus } from '@smartresidence/api-client';

type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'info';
type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export const PRIORITY_TONE: Record<ThreadPriority, Tone> = {
  LOW: 'success',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const STATUS_TONE: Record<ThreadStatus, Tone> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'neutral',
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

const STATUS_I18N_KEY: Record<ThreadStatus, string> = {
  OPEN: 'helpdesk.status.open',
  AWAITING_MANAGEMENT: 'helpdesk.status.inProgress',
  AWAITING_RESIDENT: 'helpdesk.status.waitingOnResident',
  PENDING_RESIDENT_CONFIRMATION: 'helpdesk.status.awaitingConfirmation',
  RESOLVED: 'helpdesk.status.resolved',
  CLOSED: 'helpdesk.status.closed',
  REOPENED: 'helpdesk.status.reopened',
};

const SLA_I18N_KEY: Record<Exclude<SlaState, 'NONE'>, string> = {
  ON_TRACK: 'helpdesk.sla.onTrack',
  AT_RISK: 'helpdesk.sla.atRisk',
  BREACHED: 'helpdesk.sla.breached',
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

export function formatDeadline(
  t: TFunction,
  dueIso: string,
  kind: SlaDueKind,
  now: number = Date.now(),
): string {
  const diff = new Date(dueIso).getTime() - now;
  const mag = formatDuration(Math.abs(diff));
  if (diff < 0) {
    return kind === 'firstResponse'
      ? t('helpdesk.sla.replyWasDueAgo', { time: mag })
      : t('helpdesk.sla.fixWasDueAgo', { time: mag });
  }
  return kind === 'firstResponse'
    ? t('helpdesk.sla.replyDueIn', { time: mag })
    : t('helpdesk.sla.fixDueIn', { time: mag });
}

export function formatTimeLeft(t: TFunction, dueIso: string, now: number = Date.now()): string {
  const diff = new Date(dueIso).getTime() - now;
  const mag = formatDuration(Math.abs(diff));
  return diff >= 0
    ? t('helpdesk.sla.dueIn', { time: mag })
    : t('helpdesk.sla.overdueBy', { time: mag });
}

export const CATEGORIES: Array<{ value: string; labelKey: string }> = [
  { value: 'BILLING', labelKey: 'helpdesk.category.billing' },
  { value: 'MAINTENANCE', labelKey: 'helpdesk.category.maintenance' },
  { value: 'FACILITY', labelKey: 'helpdesk.category.facility' },
  { value: 'SECURITY', labelKey: 'helpdesk.category.security' },
  { value: 'COMPLAINT', labelKey: 'helpdesk.category.complaint' },
  { value: 'SUGGESTION', labelKey: 'helpdesk.category.suggestion' },
  { value: 'GOVERNANCE', labelKey: 'helpdesk.category.governance' },
  { value: 'GENERAL', labelKey: 'helpdesk.category.general' },
];

export function statusLabel(t: TFunction, status: ThreadStatus): string {
  return t(STATUS_I18N_KEY[status]);
}

export function priorityLabel(t: TFunction, priority: ThreadPriority): string {
  return t(`helpdesk.priority.${priority}`);
}

export function slaLabel(t: TFunction, state: Exclude<SlaState, 'NONE'>): string {
  return t(SLA_I18N_KEY[state]);
}

export function categoryLabel(t: TFunction, value: string): string {
  const cat = CATEGORIES.find((c) => c.value === value);
  return cat ? t(cat.labelKey) : prettyLabel(t, value);
}

export function prettyLabel(t: TFunction, value: string): string {
  if (value in STATUS_I18N_KEY) return t(STATUS_I18N_KEY[value as ThreadStatus]);
  if (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(value)) {
    return t(`helpdesk.priority.${value as ThreadPriority}`);
  }
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
