import { describe, expect, it } from 'vitest';
import {
  normalizeHolidayState,
  resolveCondoHolidayDates,
  resolveCondoHolidayList,
  resolveMyHolidays,
} from '../src/visitor/holidays';
import { isWorkingDay } from '../src/visitor/overnight-rules';
import { parseCondoVisitorSettings } from '../src/visitor/visitor-settings';

describe('resolveMyHolidays', () => {
  it('includes core Malaysia federal public holidays', () => {
    const dates = resolveMyHolidays('', [2026]).map((h) => h.date);
    expect(dates).toContain('2026-01-01'); // New Year's Day
    expect(dates).toContain('2026-08-31'); // National Day (Merdeka)
    expect(dates).toContain('2026-09-16'); // Malaysia Day
    expect(dates).toContain('2026-12-25'); // Christmas
  });

  it('attaches friendly English holiday names', () => {
    const newYear = resolveMyHolidays('', [2026]).find((h) => h.date === '2026-01-01');
    expect(newYear?.name).toMatch(/New Year/i);
  });

  it('adds state-specific holidays when a state is selected', () => {
    const federal = new Set(resolveMyHolidays('', [2026]).map((h) => h.date));
    const selangor = resolveMyHolidays('10', [2026]).map((h) => h.date);
    // Sultan of Selangor's birthday (11 Dec) is a Selangor-only public holiday.
    expect(selangor).toContain('2026-12-11');
    expect(federal.has('2026-12-11')).toBe(false);
    // Federal holidays remain present for the state.
    for (const date of federal) {
      expect(selangor).toContain(date);
    }
  });

  it('falls back to federal for an unknown state code', () => {
    const federal = resolveMyHolidays('', [2026]).map((h) => h.date);
    const bogus = resolveMyHolidays('zz', [2026]).map((h) => h.date);
    expect(bogus).toEqual(federal);
  });
});

describe('resolveCondoHolidayList', () => {
  const now = new Date('2026-01-15T00:00:00');

  it('merges auto holidays with custom additions', () => {
    const dates = resolveCondoHolidayDates(
      {
        holidayAuto: true,
        holidayState: '',
        customHolidays: ['2026-07-04'],
        holidayExclusions: [],
      },
      now,
    );
    expect(dates).toContain('2026-01-01'); // auto
    expect(dates).toContain('2026-07-04'); // custom
  });

  it('removes excluded dates from the auto list', () => {
    const dates = resolveCondoHolidayDates(
      {
        holidayAuto: true,
        holidayState: '',
        customHolidays: [],
        holidayExclusions: ['2026-12-25'],
      },
      now,
    );
    expect(dates).not.toContain('2026-12-25');
    expect(dates).toContain('2026-01-01');
  });

  it('returns only custom holidays when auto is disabled', () => {
    const list = resolveCondoHolidayList(
      {
        holidayAuto: false,
        holidayState: '',
        customHolidays: ['2026-03-08'],
        holidayExclusions: [],
      },
      now,
    );
    expect(list).toEqual([{ date: '2026-03-08', name: 'Custom holiday' }]);
  });

  it('ignores malformed custom dates', () => {
    const dates = resolveCondoHolidayDates(
      {
        holidayAuto: false,
        holidayState: '',
        customHolidays: ['not-a-date', '2026-13-99', '2026-03-08'],
        holidayExclusions: [],
      },
      now,
    );
    expect(dates).toEqual(['2026-03-08']);
  });
});

describe('normalizeHolidayState', () => {
  it('keeps valid codes and drops invalid ones', () => {
    expect(normalizeHolidayState('10')).toBe('10');
    expect(normalizeHolidayState('zz')).toBe('');
    expect(normalizeHolidayState(undefined)).toBe('');
    expect(normalizeHolidayState(42)).toBe('');
  });
});

describe('holiday resolution drives overnight working-day logic', () => {
  it('treats an auto MY public holiday as a non-working day', () => {
    const settings = parseCondoVisitorSettings({
      visitor: { holidayAuto: true, holidayState: '', workingDays: { weekdays: [1, 2, 3, 4, 5] } },
    });
    // 31 Aug 2026 (National Day) is a Monday — a normal working weekday but a public holiday.
    const nationalDay = new Date('2026-08-31T20:00:00');
    expect(nationalDay.getDay()).toBe(1);
    expect(isWorkingDay(nationalDay, settings)).toBe(false);
  });

  it('migrates a legacy flat publicHolidays list into custom holidays', () => {
    const settings = parseCondoVisitorSettings({
      visitor: {
        workingDays: { weekdays: [1, 2, 3, 4, 5] },
        publicHolidays: ['2026-06-06'],
      },
    });
    expect(settings.holidayAuto).toBe(true);
    expect(settings.customHolidays).toContain('2026-06-06');
    expect(settings.publicHolidays).toContain('2026-06-06');
    expect(settings.publicHolidays).toContain('2026-08-31');
  });
});
