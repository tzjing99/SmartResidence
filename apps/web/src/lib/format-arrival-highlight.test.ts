import { describe, expect, it } from 'vitest';
import { getArrivalHighlight, getVisitorArrivalHighlight } from './format-arrival-highlight';

describe('getArrivalHighlight', () => {
  const now = new Date('2026-06-08T10:00:00Z').getTime();

  it('flags past arrivals as overdue', () => {
    expect(getArrivalHighlight(new Date('2026-06-08T09:00:00Z'), now)).toBe('overdue');
  });

  it('flags imminent arrivals as soon', () => {
    expect(getArrivalHighlight(new Date('2026-06-08T10:20:00Z'), now)).toBe('soon');
  });

  it('returns null for distant future arrivals', () => {
    expect(getArrivalHighlight(new Date('2026-06-08T14:00:00Z'), now)).toBeNull();
  });
});

describe('getVisitorArrivalHighlight', () => {
  const now = new Date('2026-06-08T10:00:00Z').getTime();
  const past = '2026-06-08T09:00:00Z';

  it('never flags walk-ins as overdue (they are already at the gate)', () => {
    expect(
      getVisitorArrivalHighlight(
        { expectedAt: past, visitType: 'WALKIN_UNIT', status: 'APPROVED' },
        now,
      ),
    ).toBeNull();
    expect(
      getVisitorArrivalHighlight(
        { expectedAt: past, visitType: 'WALKIN_OFFICE', status: 'CHECKED_IN' },
        now,
      ),
    ).toBeNull();
  });

  it('never flags checked-in visitors as overdue', () => {
    expect(
      getVisitorArrivalHighlight(
        { expectedAt: past, visitType: 'PRE_REG', status: 'CHECKED_IN' },
        now,
      ),
    ).toBeNull();
  });

  it('still flags overdue scheduled pre-registrations', () => {
    expect(
      getVisitorArrivalHighlight(
        { expectedAt: past, visitType: 'PRE_REG', status: 'APPROVED' },
        now,
      ),
    ).toBe('overdue');
  });
});
