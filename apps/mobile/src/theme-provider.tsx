import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ThemePreference, ThemeProvider } from '@smartresidence/ui-mobile';
import * as React from 'react';

const STORAGE_KEY = '@smartresidence/theme-preference';

export function MobileThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = React.useState<ThemePreference>('system');

  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreference(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const onPreferenceChange = React.useCallback((next: ThemePreference) => {
    setPreference(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <ThemeProvider preference={preference} onPreferenceChange={onPreferenceChange}>
      {children}
    </ThemeProvider>
  );
}
