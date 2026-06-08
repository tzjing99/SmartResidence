import type { VisitorStatus } from '@smartresidence/shared-types';

export type VisitorBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/**
 * Badge tone for a visitor status, aligned with the unified palette:
 * success = on site, warning/amber = needs attention, danger/red = declined/expired,
 * neutral = visited, primary/coral = approved & upcoming.
 */
export function visitorStatusTone(status: VisitorStatus | string): VisitorBadgeTone {
  switch (status) {
    case 'CHECKED_IN':
      return 'success';
    case 'CHECKED_OUT':
      return 'neutral';
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXPIRED':
      return 'danger';
    case 'PENDING_OWNER_APPROVAL':
    case 'PENDING_MANAGEMENT_APPROVAL':
      return 'warning';
    default:
      return 'primary';
  }
}

/** i18n key for a visitor status's plain-language label. */
export function visitorStatusLabelKey(status: VisitorStatus | string): string {
  return `visitors.statusLabel.${status}`;
}
