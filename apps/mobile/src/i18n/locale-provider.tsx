import { useMe } from '@smartresidence/api-client';
import * as React from 'react';
import { api } from '../lib/api';
import { getCachedSession, subscribeSession } from '../lib/session';
import { DEFAULT_LOCALE, type Locale, normalizeLocale, translate } from './messages';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

const LocaleContext = React.createContext<{ locale: Locale; t: TFunction }>({
  locale: DEFAULT_LOCALE,
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = React.useState(false);

  React.useEffect(() => {
    const active = true;
    void getCachedSession().then((session) => {
      if (active) setHasSession(Boolean(session?.accessToken));
    });
    return subscribeSession(() => {
      void getCachedSession().then((session) => {
        if (active) setHasSession(Boolean(session?.accessToken));
      });
    });
  }, []);

  const me = useMe(api, { enabled: hasSession });
  const locale = normalizeLocale(
    (me.data?.user as { locale?: string } | undefined)?.locale ?? DEFAULT_LOCALE,
  );

  const value = React.useMemo(
    () => ({
      locale,
      t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return React.useContext(LocaleContext);
}

export function useT() {
  return useLocale().t;
}
