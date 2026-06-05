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

/** Parsed from `condo.settings.visitor` — defaults live here until a settings UI ships. */
export type CondoVisitorSettings = {
  workingDays: { weekdays: number[] };
  overnightSlotsPerNight: number;
  publicHolidays: string[];
};

export const DEFAULT_CONDO_VISITOR_SETTINGS: CondoVisitorSettings = {
  workingDays: { weekdays: [1, 2, 3, 4, 5] },
  overnightSlotsPerNight: 10,
  publicHolidays: [...MY_PUBLIC_HOLIDAYS_2026],
};

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
  const slots =
    typeof visitor.overnightSlotsPerNight === 'number' && visitor.overnightSlotsPerNight > 0
      ? visitor.overnightSlotsPerNight
      : DEFAULT_CONDO_VISITOR_SETTINGS.overnightSlotsPerNight;
  const holidays = Array.isArray(visitor.publicHolidays)
    ? visitor.publicHolidays.filter((d): d is string => typeof d === 'string')
    : [...MY_PUBLIC_HOLIDAYS_2026];

  return {
    workingDays: { weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5] },
    overnightSlotsPerNight: slots,
    publicHolidays: holidays,
  };
}
