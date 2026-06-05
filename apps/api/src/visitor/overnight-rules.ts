import type { CondoVisitorSettings } from './visitor-settings';
import {
  DEFAULT_CONDO_VISITOR_SETTINGS,
  MY_PUBLIC_HOLIDAYS_2026,
  parseCondoVisitorSettings,
  urgentOvernightMinHours as urgentHoursFromSettings,
} from './visitor-settings';

export { MY_PUBLIC_HOLIDAYS_2026 };

/** Default overnight visitor capacity per condo per calendar night. */
export const DEFAULT_OVERNIGHT_SLOTS_PER_NIGHT =
  DEFAULT_CONDO_VISITOR_SETTINGS.overnightSlotsPerNight;

/** Fallback hours of notice for urgent overnight threshold. */
export const OVERNIGHT_ADVANCE_NOTICE_HOURS =
  DEFAULT_CONDO_VISITOR_SETTINGS.urgentOvernightMinHours;

function isUrgentArrival(now: Date, expectedAt: Date, settings: CondoVisitorSettings): boolean {
  return hoursUntilArrival(now, expectedAt) < urgentHoursFromSettings(settings);
}

export type OvernightOutcome = {
  status: 'APPROVED' | 'PENDING_MANAGEMENT_APPROVAL';
  urgentOvernight: boolean;
  pendingManagementReview: boolean;
  expectedDurationMins: number;
  isHolidayAuto: boolean;
};

export type OvernightPreview = {
  overnight: true;
  hoursUntilArrival: number;
  isUrgent: boolean;
  isHolidayAuto: boolean;
  isWorkingDayArrival: boolean;
  maxSlots: number;
  occupiedSlots: number;
  remainingSlots: number;
  slotsFull: boolean;
  nextReviewDate: string;
  helperMessage: string;
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Next hour from now, or the following hour if already on the hour boundary. */
export function defaultExpectedArrival(now = new Date()): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  if (d.getTime() <= now.getTime()) {
    d.setHours(d.getHours() + 1);
  }
  return d;
}

export function isPublicHoliday(date: Date, holidays: readonly string[]): boolean {
  return holidays.includes(dateKey(date));
}

export function isWorkingDay(date: Date, settings: CondoVisitorSettings): boolean {
  if (isPublicHoliday(date, settings.publicHolidays)) return false;
  const isoWeekday = date.getDay() === 0 ? 7 : date.getDay();
  return settings.workingDays.weekdays.includes(isoWeekday);
}

export function hoursUntilArrival(now: Date, expectedAt: Date): number {
  return (expectedAt.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** Duration for overnight stays: until 10:00 the next calendar day. */
export function overnightDurationMins(expectedAt: Date): number {
  const end = startOfLocalDay(expectedAt);
  end.setDate(end.getDate() + 1);
  end.setHours(10, 0, 0, 0);
  const mins = Math.round((end.getTime() - expectedAt.getTime()) / 60_000);
  return Math.max(mins, 480);
}

export function nextWorkingDay(from: Date, settings: CondoVisitorSettings): Date {
  const cursor = startOfLocalDay(from);
  cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < 14; i++) {
    if (isWorkingDay(cursor, settings)) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

export function nightRangeForArrival(expectedAt: Date): { start: Date; end: Date } {
  const start = startOfLocalDay(expectedAt);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function resolveOvernightOutcome(
  now: Date,
  expectedAt: Date,
  condoSettings: unknown,
  occupiedSlots: number,
): OvernightOutcome {
  const settings = parseCondoVisitorSettings(condoSettings);
  const arrivalDay = startOfLocalDay(expectedAt);
  const nonWorkingNight = !isWorkingDay(arrivalDay, settings);
  const urgent = isUrgentArrival(now, expectedAt, settings);
  const duration = overnightDurationMins(expectedAt);
  const maxSlots = settings.overnightSlotsPerNight;

  if (nonWorkingNight) {
    if (occupiedSlots >= maxSlots) {
      throw new Error('OVERNIGHT_SLOTS_FULL');
    }
    return {
      status: 'APPROVED',
      urgentOvernight: urgent,
      pendingManagementReview: true,
      expectedDurationMins: duration,
      isHolidayAuto: true,
    };
  }

  return {
    status: 'PENDING_MANAGEMENT_APPROVAL',
    urgentOvernight: urgent,
    pendingManagementReview: false,
    expectedDurationMins: duration,
    isHolidayAuto: false,
  };
}

function formatReviewDate(d: Date): string {
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function buildOvernightHelperMessage(
  now: Date,
  expectedAt: Date,
  condoSettings: unknown,
  occupiedSlots: number,
): OvernightPreview {
  const settings = parseCondoVisitorSettings(condoSettings);
  const arrivalDay = startOfLocalDay(expectedAt);
  const isWorkingDayArrival = isWorkingDay(arrivalDay, settings);
  const isHolidayAuto = !isWorkingDayArrival;
  const hoursAhead = hoursUntilArrival(now, expectedAt);
  const isUrgent = isUrgentArrival(now, expectedAt, settings);
  const maxSlots = settings.overnightSlotsPerNight;
  const remainingSlots = Math.max(0, maxSlots - occupiedSlots);
  const slotsFull = isHolidayAuto && occupiedSlots >= maxSlots;
  const nextReview = formatReviewDate(nextWorkingDay(arrivalDay, settings));

  let helperMessage: string;
  if (isHolidayAuto) {
    if (slotsFull) {
      helperMessage =
        'No overnight slots left tonight — contact management or register as urgent and visit the management office.';
    } else {
      helperMessage = `Auto-approved tonight; management reviews ${nextReview}.`;
    }
  } else if (isUrgent) {
    helperMessage = 'Urgent — visit management office before arrival.';
  } else {
    helperMessage = 'Management will approve within 1 working day.';
  }

  return {
    overnight: true,
    hoursUntilArrival: hoursAhead,
    isUrgent,
    isHolidayAuto,
    isWorkingDayArrival,
    maxSlots,
    occupiedSlots,
    remainingSlots,
    slotsFull,
    nextReviewDate: nextReview,
    helperMessage,
  };
}
