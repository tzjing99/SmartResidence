'use client';

import * as React from 'react';
import {
  LOCALE_STORAGE_KEY,
  type LocalePreference,
  detectBrowserLocale,
  parseLocalePreference,
  resolveLocale,
} from './detect-locale';
import { DEFAULT_LOCALE, type Locale, translate } from './messages';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

type LocaleContextValue = {
  locale: Locale;
  preference: LocalePreference;
  setPreference: (next: LocalePreference) => void;
  t: TFunction;
};

const LocaleContext = React.createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  preference: 'system',
  setPreference: () => undefined,
  t: (key) => key,
});

function readStoredPreference(): LocalePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    return parseLocalePreference(window.localStorage.getItem(LOCALE_STORAGE_KEY)) ?? 'system';
  } catch {
    return 'system';
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<LocalePreference>('system');
  const [systemLocale, setSystemLocale] = React.useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setPreferenceState(readStoredPreference());
    setSystemLocale(detectBrowserLocale());
    setHydrated(true);
  }, []);

  const setPreference = React.useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      // Mirror to cookie for optional SSR / Accept-Language-adjacent tooling
      document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(next)};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const locale = resolveLocale(preference, systemLocale);

  React.useEffect(() => {
    if (!hydrated || typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'zh-Hans' ? 'zh-Hans' : locale;
  }, [hydrated, locale]);

  const value = React.useMemo(
    () => ({
      locale,
      preference,
      setPreference,
      t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    }),
    [locale, preference, setPreference],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return React.useContext(LocaleContext);
}

/** Shorthand for `useLocale().t`. */
export function useT() {
  return useLocale().t;
}
