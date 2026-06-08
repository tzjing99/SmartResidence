import Holidays from 'date-holidays';

/** date-holidays state codes for Malaysia (see `new Holidays().getStates('MY')`). */
export const MY_STATE_CODES = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
]);

export type ResolvedHoliday = { date: string; name: string };

export type HolidayConfig = {
  holidayAuto: boolean;
  holidayState: string;
  customHolidays: string[];
  holidayExclusions: string[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isHolidayDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Current and next calendar year — covers near-future overnight registrations. */
export function holidayYears(now = new Date()): number[] {
  const year = now.getFullYear();
  return [year, year + 1];
}

function normalizeState(state: string): string {
  return MY_STATE_CODES.has(state) ? state : '';
}

const autoCache = new Map<string, ResolvedHoliday[]>();

/**
 * Resolve official Malaysia public holidays for the given state (federal-only when empty)
 * across the provided years. Results are memoised per state/year combination.
 */
export function resolveMyHolidays(state: string, years: number[]): ResolvedHoliday[] {
  const normalizedState = normalizeState(state);
  const cacheKey = `${normalizedState}:${[...years].sort().join(',')}`;
  const cached = autoCache.get(cacheKey);
  if (cached) return cached;

  const hd = normalizedState
    ? new Holidays('MY', normalizedState, { languages: ['en', 'ms'] })
    : new Holidays('MY', { languages: ['en', 'ms'] });

  const byDate = new Map<string, string>();
  for (const year of years) {
    for (const holiday of hd.getHolidays(year)) {
      if (holiday.type !== 'public') continue;
      const date = holiday.date.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, holiday.name);
    }
  }

  const result = [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
  autoCache.set(cacheKey, result);
  return result;
}

/**
 * Merge auto Malaysia holidays (when enabled) with manual additions, minus excluded dates.
 * Returns a sorted, de-duplicated list with friendly names for display.
 */
export function resolveCondoHolidayList(
  config: HolidayConfig,
  now = new Date(),
): ResolvedHoliday[] {
  const exclusions = new Set(config.holidayExclusions.filter(isHolidayDateString));
  const byDate = new Map<string, string>();

  if (config.holidayAuto) {
    for (const holiday of resolveMyHolidays(config.holidayState, holidayYears(now))) {
      byDate.set(holiday.date, holiday.name);
    }
  }

  for (const date of config.customHolidays) {
    if (!isHolidayDateString(date)) continue;
    if (!byDate.has(date)) byDate.set(date, 'Custom holiday');
  }

  for (const date of exclusions) {
    byDate.delete(date);
  }

  return [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Effective holiday dates (YYYY-MM-DD) used by overnight auto-approval logic. */
export function resolveCondoHolidayDates(config: HolidayConfig, now = new Date()): string[] {
  return resolveCondoHolidayList(config, now).map((holiday) => holiday.date);
}

export function normalizeHolidayState(state: unknown): string {
  return typeof state === 'string' ? normalizeState(state) : '';
}
