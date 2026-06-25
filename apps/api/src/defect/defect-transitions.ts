import { DefectStatus } from '@prisma/client';

/**
 * Allowed status transitions for the defect / maintenance lifecycle.
 *
 * SUBMITTED(NEW) → ACKNOWLEDGED(ACK) → ASSIGNED → IN_PROGRESS → RESOLVED →
 * CLOSED, with a REOPENED branch out of RESOLVED/CLOSED. Kept as the single
 * source of truth for the guard so it can be unit-tested in isolation.
 */
export const VALID_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  [DefectStatus.NEW]: [
    DefectStatus.ACK,
    DefectStatus.ASSIGNED,
    DefectStatus.RESOLVED,
    DefectStatus.CLOSED,
  ],
  [DefectStatus.ACK]: [
    DefectStatus.ASSIGNED,
    DefectStatus.IN_PROGRESS,
    DefectStatus.RESOLVED,
    DefectStatus.CLOSED,
  ],
  [DefectStatus.ASSIGNED]: [DefectStatus.IN_PROGRESS, DefectStatus.RESOLVED, DefectStatus.CLOSED],
  [DefectStatus.IN_PROGRESS]: [DefectStatus.RESOLVED, DefectStatus.CLOSED],
  [DefectStatus.RESOLVED]: [DefectStatus.CLOSED, DefectStatus.REOPENED],
  [DefectStatus.CLOSED]: [DefectStatus.REOPENED],
  [DefectStatus.REOPENED]: [
    DefectStatus.ASSIGNED,
    DefectStatus.IN_PROGRESS,
    DefectStatus.RESOLVED,
    DefectStatus.CLOSED,
  ],
};

/** Whether a defect may legally move from `from` to `to`. */
export function canTransitionDefect(from: DefectStatus, to: DefectStatus): boolean {
  if (from === to) return false;
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}
