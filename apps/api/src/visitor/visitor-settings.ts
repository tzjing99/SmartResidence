import { VisitorPurpose } from '@prisma/client';
import { PRE_REG_EXPIRY_BUFFER_MINS, WALK_IN_APPROVAL_MINUTES } from './visitor.constants';

/** Malaysia public holidays for 2026 (hardcoded fallback; override via condo.settings.visitor). */
export const MY_PUBLIC_HOLIDAYS_2026 = [
  '2026-01-01',
  '2026-01-29',
  '2026-01-30',
  '2026-02-01',
  '2026-05-01',
  '2026-05-31',
  '2026-06-01',
  '2026-08-31',
  '2026-09-16',
  '2026-10-29',
  '2026-12-25',
] as const;

/** Parsed from `condo.settings.visitor` — constants in visitor.constants.ts are fallbacks only. */
export type CondoVisitorSettings = {
  maxOvernightVisitsPerUnitPerMonth: number;
  overnightSlotsPerNight: number;
  walkInApprovalMinutes: number;
  preRegExpiryBufferMins: number;
  urgentOvernightMinHours: number;
  workingDays: { weekdays: number[] };
  publicHolidays: string[];
  countPendingTowardCap: boolean;
  requirePlatePhotoOvernight: boolean;
  defaultPurpose: VisitorPurpose;
};

export const DEFAULT_CONDO_VISITOR_SETTINGS: CondoVisitorSettings = {
  maxOvernightVisitsPerUnitPerMonth: 4,
  overnightSlotsPerNight: 10,
  walkInApprovalMinutes: WALK_IN_APPROVAL_MINUTES,
  preRegExpiryBufferMins: PRE_REG_EXPIRY_BUFFER_MINS,
  urgentOvernightMinHours: 24,
  workingDays: { weekdays: [1, 2, 3, 4, 5] },
  publicHolidays: [...MY_PUBLIC_HOLIDAYS_2026],
  countPendingTowardCap: true,
  requirePlatePhotoOvernight: true,
  defaultPurpose: VisitorPurpose.VISITOR,
};

/** @deprecated Use maxOvernightVisitsPerUnitPerMonth */
export const DEFAULT_MAX_OVERNIGHT_PER_OWNER_PER_MONTH =
  DEFAULT_CONDO_VISITOR_SETTINGS.maxOvernightVisitsPerUnitPerMonth;

function parsePositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && value > 0 && Number.isInteger(value) ? value : fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parsePurpose(value: unknown, fallback: VisitorPurpose): VisitorPurpose {
  if (typeof value !== 'string') return fallback;
  const values = Object.values(VisitorPurpose) as string[];
  return values.includes(value) ? (value as VisitorPurpose) : fallback;
}

export function parseCondoVisitorSettings(settings: unknown): CondoVisitorSettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_CONDO_VISITOR_SETTINGS, publicHolidays: [...MY_PUBLIC_HOLIDAYS_2026] };
  }
  const raw = (settings as Record<string, unknown>).visitor;
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CONDO_VISITOR_SETTINGS, publicHolidays: [...MY_PUBLIC_HOLIDAYS_2026] };
  }
  const visitor = raw as Record<string, unknown>;

  const workingDaysRaw = visitor.workingDays;
  let weekdays = DEFAULT_CONDO_VISITOR_SETTINGS.workingDays.weekdays;
  if (workingDaysRaw && typeof workingDaysRaw === 'object') {
    const wd = (workingDaysRaw as Record<string, unknown>).weekdays;
    if (Array.isArray(wd)) {
      weekdays = wd.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7);
    }
  }

  const holidays = Array.isArray(visitor.publicHolidays)
    ? visitor.publicHolidays.filter((d): d is string => typeof d === 'string')
    : [...MY_PUBLIC_HOLIDAYS_2026];

  const monthlyCap =
    typeof visitor.maxOvernightVisitsPerUnitPerMonth === 'number' &&
    visitor.maxOvernightVisitsPerUnitPerMonth > 0
      ? visitor.maxOvernightVisitsPerUnitPerMonth
      : typeof visitor.maxOvernightVisitsPerOwnerPerMonth === 'number' &&
          visitor.maxOvernightVisitsPerOwnerPerMonth > 0
        ? visitor.maxOvernightVisitsPerOwnerPerMonth
        : DEFAULT_CONDO_VISITOR_SETTINGS.maxOvernightVisitsPerUnitPerMonth;

  return {
    maxOvernightVisitsPerUnitPerMonth: monthlyCap,
    overnightSlotsPerNight: parsePositiveInt(
      visitor.overnightSlotsPerNight,
      DEFAULT_CONDO_VISITOR_SETTINGS.overnightSlotsPerNight,
    ),
    walkInApprovalMinutes: parsePositiveInt(
      visitor.walkInApprovalMinutes,
      DEFAULT_CONDO_VISITOR_SETTINGS.walkInApprovalMinutes,
    ),
    preRegExpiryBufferMins: parsePositiveInt(
      visitor.preRegExpiryBufferMins,
      DEFAULT_CONDO_VISITOR_SETTINGS.preRegExpiryBufferMins,
    ),
    urgentOvernightMinHours: parsePositiveInt(
      visitor.urgentOvernightMinHours,
      DEFAULT_CONDO_VISITOR_SETTINGS.urgentOvernightMinHours,
    ),
    workingDays: { weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5] },
    publicHolidays: holidays,
    countPendingTowardCap: parseBoolean(
      visitor.countPendingTowardCap,
      DEFAULT_CONDO_VISITOR_SETTINGS.countPendingTowardCap,
    ),
    requirePlatePhotoOvernight: parseBoolean(
      visitor.requirePlatePhotoOvernight,
      DEFAULT_CONDO_VISITOR_SETTINGS.requirePlatePhotoOvernight,
    ),
    defaultPurpose: parsePurpose(
      visitor.defaultPurpose,
      DEFAULT_CONDO_VISITOR_SETTINGS.defaultPurpose,
    ),
  };
}

export function mergeVisitorSettings(
  condoSettings: unknown,
  patch: Partial<CondoVisitorSettings>,
): Record<string, unknown> {
  const base =
    condoSettings && typeof condoSettings === 'object'
      ? { ...(condoSettings as Record<string, unknown>) }
      : {};
  const current = parseCondoVisitorSettings(condoSettings);
  const visitor = {
    maxOvernightVisitsPerUnitPerMonth:
      patch.maxOvernightVisitsPerUnitPerMonth ?? current.maxOvernightVisitsPerUnitPerMonth,
    overnightSlotsPerNight: patch.overnightSlotsPerNight ?? current.overnightSlotsPerNight,
    walkInApprovalMinutes: patch.walkInApprovalMinutes ?? current.walkInApprovalMinutes,
    preRegExpiryBufferMins: patch.preRegExpiryBufferMins ?? current.preRegExpiryBufferMins,
    urgentOvernightMinHours: patch.urgentOvernightMinHours ?? current.urgentOvernightMinHours,
    workingDays: patch.workingDays ?? current.workingDays,
    publicHolidays: patch.publicHolidays ?? current.publicHolidays,
    countPendingTowardCap: patch.countPendingTowardCap ?? current.countPendingTowardCap,
    requirePlatePhotoOvernight:
      patch.requirePlatePhotoOvernight ?? current.requirePlatePhotoOvernight,
    defaultPurpose: patch.defaultPurpose ?? current.defaultPurpose,
  };
  return { ...base, visitor };
}

export function preRegExpiryBufferMins(settings: CondoVisitorSettings): number {
  return settings.preRegExpiryBufferMins;
}

export function walkInApprovalMinutes(settings: CondoVisitorSettings): number {
  return settings.walkInApprovalMinutes;
}

export function urgentOvernightMinHours(settings: CondoVisitorSettings): number {
  return settings.urgentOvernightMinHours;
}
