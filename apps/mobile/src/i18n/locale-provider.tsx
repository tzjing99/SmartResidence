import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import {
  LOCALE_STORAGE_KEY,
  type LocalePreference,
  detectDeviceLocale,
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

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<LocalePreference>('system');
  const [systemLocale] = React.useState<Locale>(() => detectDeviceLocale());

  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      if (!active) return;
      const parsed = parseLocalePreference(stored);
      if (parsed) setPreferenceState(parsed);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = React.useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const locale = resolveLocale(preference, systemLocale);

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
