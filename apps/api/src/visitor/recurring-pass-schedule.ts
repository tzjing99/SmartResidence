import type { RecurringPassSchedule } from '@smartresidence/shared-types';

/** ISO weekday 1=Mon … 7=Sun in the given IANA timezone. */
export function zonedIsoWeekday(instant: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 1;
}

/** Local HH:mm for an instant in a timezone. */
export function zonedTimeHm(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

export function isWithinRecurringSchedule(
  schedule: RecurringPassSchedule,
  instant: Date,
  timeZone: string,
): { ok: boolean; message?: string } {
  const weekday = zonedIsoWeekday(instant, timeZone);
  if (!schedule.daysOfWeek.includes(weekday)) {
    return {
      ok: false,
      message: `Recurring pass is not valid on ${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday]}`,
    };
  }

  const nowHm = zonedTimeHm(instant, timeZone);
  const { start, end } = schedule.timeWindow;
  if (nowHm < start || nowHm >= end) {
    return {
      ok: false,
      message: `Outside allowed window (${start}–${end})`,
    };
  }

  return { ok: true };
}

export function parseRecurringPassSchedule(raw: unknown): RecurringPassSchedule {
  const schedule = raw as RecurringPassSchedule;
  if (
    !schedule ||
    !Array.isArray(schedule.daysOfWeek) ||
    !schedule.timeWindow?.start ||
    !schedule.timeWindow?.end
  ) {
    throw new Error('Invalid recurring pass schedule');
  }
  return schedule;
}
