import { describe, expect, it } from 'vitest';
import {
  HISTORY_VISITOR_STATUSES,
  LIVE_VISITOR_STATUSES,
  UPCOMING_VISITOR_STATUSES,
  statusesForView,
} from '../src/visitor/visitor.constants';

describe('visitor list view filters', () => {
  it('upcoming excludes checked-in visitors', () => {
    expect(UPCOMING_VISITOR_STATUSES).not.toContain('CHECKED_IN');
    expect(UPCOMING_VISITOR_STATUSES).toEqual(
      expect.arrayContaining(['APPROVED', 'PENDING_OWNER_APPROVAL', 'PENDING_MANAGEMENT_APPROVAL']),
    );
  });

  it('live includes only checked-in visitors', () => {
    expect(LIVE_VISITOR_STATUSES).toEqual(['CHECKED_IN']);
  });

  it('history includes checked-out and terminal statuses', () => {
    expect(HISTORY_VISITOR_STATUSES).toContain('CHECKED_OUT');
    expect(HISTORY_VISITOR_STATUSES).not.toContain('CHECKED_IN');
    expect(HISTORY_VISITOR_STATUSES).not.toContain('APPROVED');
  });

  it('statusesForView maps each tab', () => {
    expect(statusesForView('upcoming')).toBe(UPCOMING_VISITOR_STATUSES);
    expect(statusesForView('expected')).toBe(UPCOMING_VISITOR_STATUSES);
    expect(statusesForView('live')).toBe(LIVE_VISITOR_STATUSES);
    expect(statusesForView('history')).toBe(HISTORY_VISITOR_STATUSES);
    expect(statusesForView('no_show')).toEqual(['EXPIRED']);
    expect(statusesForView(undefined)).toBeUndefined();
  });
});
