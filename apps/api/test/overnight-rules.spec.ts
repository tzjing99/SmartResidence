import { describe, expect, it } from 'vitest';
import {
  buildOvernightHelperMessage,
  hoursUntilArrival,
  isWorkingDay,
  resolveOvernightOutcome,
} from '../src/visitor/overnight-rules';
import { parseCondoVisitorSettings } from '../src/visitor/visitor-settings';

describe('overnight-rules', () => {
  const condoSettings = {
    visitor: {
      workingDays: { weekdays: [1, 2, 3, 4, 5] },
      overnightSlotsPerNight: 10,
      publicHolidays: ['2026-06-06'],
    },
  };

  it('treats Saturday as non-working (holiday auto path)', () => {
    const saturday = new Date('2026-06-06T20:00:00');
    const settings = parseCondoVisitorSettings(condoSettings);
    expect(isWorkingDay(saturday, settings)).toBe(false);
  });

  it('requires management approval for weekday overnight with 48h notice', () => {
    const now = new Date('2026-06-02T10:00:00');
    const expectedAt = new Date('2026-06-04T20:00:00');
    const outcome = resolveOvernightOutcome(now, expectedAt, condoSettings, 0);
    expect(outcome.status).toBe('PENDING_MANAGEMENT_APPROVAL');
    expect(outcome.urgentOvernight).toBe(false);
    expect(outcome.isHolidayAuto).toBe(false);
  });

  it('flags urgent overnight when less than 24h on working day', () => {
    const now = new Date('2026-06-03T18:00:00');
    const expectedAt = new Date('2026-06-04T10:00:00');
    const outcome = resolveOvernightOutcome(now, expectedAt, condoSettings, 0);
    expect(outcome.urgentOvernight).toBe(true);
    expect(outcome.status).toBe('PENDING_MANAGEMENT_APPROVAL');
  });

  it('auto-approves holiday overnight when slots available', () => {
    const now = new Date('2026-06-05T10:00:00');
    const expectedAt = new Date('2026-06-06T20:00:00');
    const outcome = resolveOvernightOutcome(now, expectedAt, condoSettings, 3);
    expect(outcome.status).toBe('APPROVED');
    expect(outcome.pendingManagementReview).toBe(true);
    expect(outcome.isHolidayAuto).toBe(true);
  });

  it('throws when holiday overnight slots are full', () => {
    const now = new Date('2026-06-05T10:00:00');
    const expectedAt = new Date('2026-06-06T20:00:00');
    expect(() => resolveOvernightOutcome(now, expectedAt, condoSettings, 10)).toThrow(
      'OVERNIGHT_SLOTS_FULL',
    );
  });

  it('builds helper messages for standard, urgent, and holiday paths', () => {
    const weekdayFuture = new Date('2026-06-04T20:00:00');
    const previewStd = buildOvernightHelperMessage(
      new Date('2026-06-02T10:00:00'),
      weekdayFuture,
      condoSettings,
      0,
    );
    expect(previewStd.helperMessage).toContain('Management will approve');

    const previewUrgent = buildOvernightHelperMessage(
      new Date('2026-06-04T08:00:00'),
      new Date('2026-06-04T20:00:00'),
      condoSettings,
      0,
    );
    expect(previewUrgent.isUrgent).toBe(true);
    expect(previewUrgent.helperMessage).toContain('management office');

    const previewHoliday = buildOvernightHelperMessage(
      new Date('2026-06-05T10:00:00'),
      new Date('2026-06-06T20:00:00'),
      condoSettings,
      2,
    );
    expect(previewHoliday.isHolidayAuto).toBe(true);
    expect(previewHoliday.remainingSlots).toBe(8);
    expect(previewHoliday.helperMessage).toContain('Auto-approved');
  });

  it('computes hours until arrival', () => {
    const now = new Date('2026-06-01T10:00:00');
    const expected = new Date('2026-06-02T10:00:00');
    expect(hoursUntilArrival(now, expected)).toBe(24);
  });
});
