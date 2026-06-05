import { VisitorStatus } from '@prisma/client';

/** Default visit window when resident does not specify duration. */
export const DEFAULT_VISIT_DURATION_MINS = 120;

/** Extra buffer after visit window before pre-reg pass expires (2h). */
export const PRE_REG_EXPIRY_BUFFER_MINS = 120;

/** Owner must respond to unit walk-in within this window. */
export const WALK_IN_APPROVAL_MINUTES = 15;

/** After owner approves a walk-in, guard has this long to check them in. */
export const WALK_IN_CHECK_IN_WINDOW_MINS = 120;

/** Active passes and pending walk-in approvals. */
export const UPCOMING_VISITOR_STATUSES: VisitorStatus[] = [
  VisitorStatus.PENDING_OWNER_APPROVAL,
  VisitorStatus.APPROVED,
  VisitorStatus.CHECKED_IN,
];

/** Completed, expired, or declined visits. */
export const HISTORY_VISITOR_STATUSES: VisitorStatus[] = [
  VisitorStatus.CHECKED_OUT,
  VisitorStatus.EXPIRED,
  VisitorStatus.REJECTED,
  VisitorStatus.CANCELLED,
];

export type VisitorListView = 'upcoming' | 'history';

export function statusesForView(view?: VisitorListView): VisitorStatus[] | undefined {
  if (view === 'upcoming') return UPCOMING_VISITOR_STATUSES;
  if (view === 'history') return HISTORY_VISITOR_STATUSES;
  return undefined;
}
