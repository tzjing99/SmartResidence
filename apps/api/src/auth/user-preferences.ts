export interface QuietHoursSettings {
  enabled: boolean;
  /** Local time "HH:mm" (24h). */
  start: string;
  end: string;
}

export interface UserPreferences {
  /** E1: thread notifications via email (default off; in-app + push always on). */
  emailNotifications: boolean;
  /** E5: suppress push during quiet hours (in-app still delivered). */
  quietHours: QuietHoursSettings;
}

const DEFAULT_QUIET: QuietHoursSettings = {
  enabled: false,
  start: '22:00',
  end: '07:00',
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  emailNotifications: false,
  quietHours: DEFAULT_QUIET,
};

export function parseUserPreferences(raw: unknown): UserPreferences {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const qh = (obj.quietHours && typeof obj.quietHours === 'object' ? obj.quietHours : {}) as Record<
    string,
    unknown
  >;
  return {
    emailNotifications: obj.emailNotifications === true,
    quietHours: {
      enabled: qh.enabled === true,
      start: typeof qh.start === 'string' ? qh.start : DEFAULT_QUIET.start,
      end: typeof qh.end === 'string' ? qh.end : DEFAULT_QUIET.end,
    },
  };
}

export function mergeUserPreferences(
  existing: unknown,
  patch: Partial<Omit<UserPreferences, 'quietHours'>> & {
    quietHours?: Partial<QuietHoursSettings>;
  },
): UserPreferences {
  const current = parseUserPreferences(existing);
  return {
    emailNotifications: patch.emailNotifications ?? current.emailNotifications,
    quietHours: patch.quietHours
      ? { ...current.quietHours, ...patch.quietHours }
      : current.quietHours,
  };
}

/** Returns true when local time falls inside quiet-hours window (supports overnight spans). */
export function isInQuietHours(
  prefs: UserPreferences,
  now: Date = new Date(),
  timeZone?: string,
): boolean {
  if (!prefs.quietHours.enabled) return false;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone ?? undefined,
  });
  const parts = fmt.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const current = `${hour}:${minute}`;
  const { start, end } = prefs.quietHours;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}
