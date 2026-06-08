export type ArrivalHighlight = 'soon' | 'overdue' | null;

export function getArrivalHighlight(expectedAt: Date, now = Date.now()): ArrivalHighlight {
  const ms = expectedAt.getTime() - now;
  if (ms < 0) return 'overdue';
  if (ms <= 30 * 60 * 1000) return 'soon';
  return null;
}

/**
 * "Arriving soon / overdue" only applies to scheduled pre-registrations.
 * Walk-ins are physically at the gate (their expectedAt is the registration time, so
 * they would otherwise always read as "overdue"), and anyone already on site or in a
 * terminal state can never be overdue. Returns null for those cases.
 */
export function getVisitorArrivalHighlight(
  visitor: { expectedAt: Date | string; visitType: string; status: string },
  now = Date.now(),
): ArrivalHighlight {
  if (visitor.visitType !== 'PRE_REG') return null;
  if (visitor.status !== 'APPROVED' && visitor.status !== 'PENDING_MANAGEMENT_APPROVAL') {
    return null;
  }
  return getArrivalHighlight(new Date(visitor.expectedAt), now);
}

export function minutesUntilArrival(expectedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.round((expectedAt.getTime() - now) / 60_000));
}
