export type Locale = 'en' | 'ms' | 'zh-Hans';

export const DEFAULT_LOCALE: Locale = 'en';

/** Supported UI locales only. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ms', 'zh-Hans'] as const;

export type LocalePreference = 'system' | Locale;

export const LOCALE_STORAGE_KEY = 'smartresidence.locale-preference';

/**
 * Map a BCP-47 / OS language tag to a supported app locale.
 * - en* → en
 * - ms* / msa / Malay → ms
 * - zh* → zh-Hans
 * - else → en
 */
export function mapLanguageTag(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE;
  const normalized = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return DEFAULT_LOCALE;

  const primary = normalized.split('-')[0] ?? normalized;

  if (primary === 'en') return 'en';
  if (primary === 'ms' || primary === 'msa' || normalized.includes('malay')) return 'ms';
  if (primary === 'zh') return 'zh-Hans';

  return DEFAULT_LOCALE;
}

/** First matching tag from a list (navigator.languages / Accept-Language order). */
export function detectLocaleFromTags(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase().replace(/_/g, '-');
    const primary = normalized.split('-')[0] ?? normalized;
    if (primary === 'en') return 'en';
    if (primary === 'ms' || primary === 'msa' || normalized.includes('malay')) return 'ms';
    if (primary === 'zh') return 'zh-Hans';
  }
  return DEFAULT_LOCALE;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const tags =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? [...navigator.languages]
      : navigator.language
        ? [navigator.language]
        : [];
  return detectLocaleFromTags(tags);
}

export function parseLocalePreference(value: string | null | undefined): LocalePreference | null {
  if (value === 'system' || value === 'en' || value === 'ms' || value === 'zh-Hans') return value;
  return null;
}

export function resolveLocale(preference: LocalePreference, systemLocale: Locale): Locale {
  return preference === 'system' ? systemLocale : preference;
}
