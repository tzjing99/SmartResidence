import { VisitorStatus } from '@prisma/client';

/** Default visit window when resident does not specify duration. */
export const DEFAULT_VISIT_DURATION_MINS = 120;

/** Default visit window for food delivery quick-entry passes. */
export const DEFAULT_DELIVERY_DURATION_MINS = 120;

/** Default visit window for e-hailing quick-entry passes. */
export const DEFAULT_E_HAILING_DURATION_MINS = 180;

/** Extra buffer after quick-entry pass window before expiry (30 minutes). */
export const QUICK_ENTRY_EXPIRY_BUFFER_MINS = 30;

/** Extra buffer after visit window before pre-reg pass expires (2h). */
export const PRE_REG_EXPIRY_BUFFER_MINS = 120;

/** Owner must respond to unit walk-in within this window. */
export const WALK_IN_APPROVAL_MINUTES = 15;

/** After owner approves a walk-in, guard has this long to check them in. */
export const WALK_IN_CHECK_IN_WINDOW_MINS = 120;

/** Active passes and pending walk-in approvals — not yet checked in. */
export const UPCOMING_VISITOR_STATUSES: VisitorStatus[] = [
  VisitorStatus.PENDING_OWNER_APPROVAL,
  VisitorStatus.PENDING_MANAGEMENT_APPROVAL,
  VisitorStatus.APPROVED,
];

/** Visitors currently on site (checked in, not checked out). */
export const LIVE_VISITOR_STATUSES: VisitorStatus[] = [VisitorStatus.CHECKED_IN];

/** Admin audit: upcoming passes plus visitors currently on site. */
export const ACTIVE_VISITOR_STATUSES: VisitorStatus[] = [
  ...UPCOMING_VISITOR_STATUSES,
  ...LIVE_VISITOR_STATUSES,
];

/** Admin list filters for overnight management queues. */
export type VisitorAdminFilter = 'overnight_pending' | 'urgent_overnight' | 'holiday_review';

/** Completed, expired, or declined visits. */
export const HISTORY_VISITOR_STATUSES: VisitorStatus[] = [
  VisitorStatus.CHECKED_OUT,
  VisitorStatus.EXPIRED,
  VisitorStatus.REJECTED,
  VisitorStatus.CANCELLED,
];

export type VisitorListView = 'upcoming' | 'live' | 'active' | 'history' | 'expected' | 'no_show';

export function statusesForView(view?: VisitorListView): VisitorStatus[] | undefined {
  if (view === 'upcoming' || view === 'expected') return UPCOMING_VISITOR_STATUSES;
  if (view === 'live') return LIVE_VISITOR_STATUSES;
  if (view === 'active') return ACTIVE_VISITOR_STATUSES;
  if (view === 'history') return HISTORY_VISITOR_STATUSES;
  if (view === 'no_show') return [VisitorStatus.EXPIRED];
  return undefined;
}
