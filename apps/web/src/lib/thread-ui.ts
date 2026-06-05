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
