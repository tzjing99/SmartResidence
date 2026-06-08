import { VisitorPurpose } from '@prisma/client';
import {
  type ResolvedHoliday,
  isHolidayDateString,
  normalizeHolidayState,
  resolveCondoHolidayList,
  resolveMyHolidays,
} from './holidays';
import { PRE_REG_EXPIRY_BUFFER_MINS, WALK_IN_APPROVAL_MINUTES } from './visitor.constants';

/**
 * Malaysia public holidays for 2026 (federal). Retained for tests and any legacy callers; live
 * holiday resolution now uses the `date-holidays` package (see holidays.ts) and condo config.
 */
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
  /** When true, unit walk-ins wait for owner/tenant approval before check-in. */
  walkInRequireOwnerApproval: boolean;
  preRegExpiryBufferMins: number;
  urgentOvernightMinHours: number;
  workingDays: { weekdays: number[] };
  /** Auto-populate Malaysia public holidays from a maintained source. */
  holidayAuto: boolean;
  /** date-holidays state code ('' = federal/nationwide only). */
  holidayState: string;
  /** Manually added holiday dates (YYYY-MM-DD) on top of the auto list. */
  customHolidays: string[];
  /** Auto holiday dates the condo has chosen to exclude (YYYY-MM-DD). */
  holidayExclusions: string[];
  /** Effective resolved holiday dates used by overnight auto-approval logic. */
  publicHolidays: string[];
  /** Effective resolved holidays with friendly names, for display only. */
  resolvedHolidays: ResolvedHoliday[];
  /** When true, overnight on holidays/non-working days is auto-approved if slots are available. */
  holidayOvernightAutoApprove: boolean;
  countPendingTowardCap: boolean;
  requirePlatePhotoOvernight: boolean;
  defaultPurpose: VisitorPurpose;
};

const DEFAULT_HOLIDAY_CONFIG = {
  holidayAuto: true,
  holidayState: '',
  customHolidays: [] as string[],
  holidayExclusions: [] as string[],
};

const DEFAULT_RESOLVED_HOLIDAYS = resolveCondoHolidayList(DEFAULT_HOLIDAY_CONFIG);

export const DEFAULT_CONDO_VISITOR_SETTINGS: CondoVisitorSettings = {
  maxOvernightVisitsPerUnitPerMonth: 4,
  overnightSlotsPerNight: 10,
  walkInApprovalMinutes: WALK_IN_APPROVAL_MINUTES,
  walkInRequireOwnerApproval: true,
  preRegExpiryBufferMins: PRE_REG_EXPIRY_BUFFER_MINS,
  urgentOvernightMinHours: 24,
  workingDays: { weekdays: [1, 2, 3, 4, 5] },
  holidayAuto: true,
  holidayState: '',
  customHolidays: [],
  holidayExclusions: [],
  publicHolidays: DEFAULT_RESOLVED_HOLIDAYS.map((h) => h.date),
  resolvedHolidays: DEFAULT_RESOLVED_HOLIDAYS,
  holidayOvernightAutoApprove: true,
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

function defaultsWithFreshHolidays(): CondoVisitorSettings {
  const resolved = resolveCondoHolidayList(DEFAULT_HOLIDAY_CONFIG);
  return {
    ...DEFAULT_CONDO_VISITOR_SETTINGS,
    publicHolidays: resolved.map((h) => h.date),
    resolvedHolidays: resolved,
  };
}

type ParsedHolidayConfig = {
  holidayAuto: boolean;
  holidayState: string;
  customHolidays: string[];
  holidayExclusions: string[];
};

/**
 * Parse the stored holiday configuration, migrating legacy records (which only stored a flat
 * `publicHolidays` array) by preserving any non-standard dates as custom holidays.
 */
function parseHolidayConfig(visitor: Record<string, unknown>): ParsedHolidayConfig {
  const holidayState = normalizeHolidayState(visitor.holidayState);
  const holidayExclusions = Array.isArray(visitor.holidayExclusions)
    ? visitor.holidayExclusions.filter(isHolidayDateString)
    : [];

  const isLegacy = typeof visitor.holidayAuto !== 'boolean';
  const holidayAuto = isLegacy ? true : (visitor.holidayAuto as boolean);

  let customHolidays = Array.isArray(visitor.customHolidays)
    ? visitor.customHolidays.filter(isHolidayDateString)
    : [];

  if (isLegacy && customHolidays.length === 0 && Array.isArray(visitor.publicHolidays)) {
    const legacy = visitor.publicHolidays.filter(isHolidayDateString);
    if (legacy.length) {
      const autoDates = new Set(
        resolveMyHolidays(holidayState, [
          new Date().getFullYear(),
          new Date().getFullYear() + 1,
        ]).map((h) => h.date),
      );
      customHolidays = legacy.filter((d) => !autoDates.has(d));
    }
  }

  return { holidayAuto, holidayState, customHolidays, holidayExclusions };
}

export function parseCondoVisitorSettings(settings: unknown): CondoVisitorSettings {
  if (!settings || typeof settings !== 'object') {
    return defaultsWithFreshHolidays();
  }
  const raw = (settings as Record<string, unknown>).visitor;
  if (!raw || typeof raw !== 'object') {
    return defaultsWithFreshHolidays();
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

  const holidayConfig = parseHolidayConfig(visitor);
  const resolvedHolidays = resolveCondoHolidayList(holidayConfig);

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
    walkInRequireOwnerApproval: parseBoolean(
      visitor.walkInRequireOwnerApproval,
      DEFAULT_CONDO_VISITOR_SETTINGS.walkInRequireOwnerApproval,
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
    holidayAuto: holidayConfig.holidayAuto,
    holidayState: holidayConfig.holidayState,
    customHolidays: holidayConfig.customHolidays,
    holidayExclusions: holidayConfig.holidayExclusions,
    publicHolidays: resolvedHolidays.map((h) => h.date),
    resolvedHolidays,
    holidayOvernightAutoApprove: parseBoolean(
      visitor.holidayOvernightAutoApprove,
      DEFAULT_CONDO_VISITOR_SETTINGS.holidayOvernightAutoApprove,
    ),
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

  const holidayConfig = {
    holidayAuto: patch.holidayAuto ?? current.holidayAuto,
    holidayState: normalizeHolidayState(patch.holidayState ?? current.holidayState),
    customHolidays: (patch.customHolidays ?? current.customHolidays).filter(isHolidayDateString),
    holidayExclusions: (patch.holidayExclusions ?? current.holidayExclusions).filter(
      isHolidayDateString,
    ),
  };
  const resolvedHolidays = resolveCondoHolidayList(holidayConfig);

  const visitor = {
    maxOvernightVisitsPerUnitPerMonth:
      patch.maxOvernightVisitsPerUnitPerMonth ?? current.maxOvernightVisitsPerUnitPerMonth,
    overnightSlotsPerNight: patch.overnightSlotsPerNight ?? current.overnightSlotsPerNight,
    walkInApprovalMinutes: patch.walkInApprovalMinutes ?? current.walkInApprovalMinutes,
    walkInRequireOwnerApproval:
      patch.walkInRequireOwnerApproval ?? current.walkInRequireOwnerApproval,
    preRegExpiryBufferMins: patch.preRegExpiryBufferMins ?? current.preRegExpiryBufferMins,
    urgentOvernightMinHours: patch.urgentOvernightMinHours ?? current.urgentOvernightMinHours,
    workingDays: patch.workingDays ?? current.workingDays,
    holidayAuto: holidayConfig.holidayAuto,
    holidayState: holidayConfig.holidayState,
    customHolidays: holidayConfig.customHolidays,
    holidayExclusions: holidayConfig.holidayExclusions,
    publicHolidays: resolvedHolidays.map((h) => h.date),
    holidayOvernightAutoApprove:
      patch.holidayOvernightAutoApprove ?? current.holidayOvernightAutoApprove,
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
