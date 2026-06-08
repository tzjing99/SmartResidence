/** Calendar day key (YYYY-MM-DD) for an instant in an IANA timezone. */
export function zonedDayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Invalid day key: ${dayKey}`);
  }
  return { year, month, day };
}

function addDaysToDayKey(dayKey: string, days: number): string {
  const { year, month, day } = parseDayKey(dayKey);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

/** UTC instant of local midnight for a calendar day in the given timezone. */
export function zonedMidnightUtc(dayKey: string, timeZone: string): Date {
  const { year, month, day } = parseDayKey(dayKey);
  let low = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
  let high = Date.UTC(year, month - 1, day + 2, 0, 0, 0);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midKey = zonedDayKey(new Date(mid), timeZone);
    if (midKey < dayKey) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}

/** Start (inclusive) and end (exclusive) of the calendar day in a condo timezone. */
export function condoDayBounds(timeZone: string, instant = new Date()): { start: Date; end: Date } {
  const dayKey = zonedDayKey(instant, timeZone);
  const start = zonedMidnightUtc(dayKey, timeZone);
  const end = zonedMidnightUtc(addDaysToDayKey(dayKey, 1), timeZone);
  return { start, end };
}
