import * as React from 'react';
import { useColorScheme } from 'react-native';
import { type ThemeColors, type ThemeMode, themeColorsForMode } from './colors';

export type ThemePreference = 'system' | ThemeMode;

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedMode: ThemeMode;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
  preference: ThemePreference;
  onPreferenceChange: (preference: ThemePreference) => void;
};

export function ThemeProvider({ children, preference, onPreferenceChange }: ThemeProviderProps) {
  const systemScheme = useColorScheme();

  const resolvedMode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = React.useMemo(
    () => ({
      preference,
      resolvedMode,
      colors: themeColorsForMode(resolvedMode),
      setPreference: onPreferenceChange,
    }),
    [onPreferenceChange, preference, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
