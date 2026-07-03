/**
 * Semantic colors aligned with packages/ui-web/src/styles.css CSS variables.
 * Light mode keeps the mobile warm shell (#FFF8F6); dark mode mirrors web `.dark`.
 */
export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  cardBorder: string;
  card: string;
  surface: string;
  coral: string;
  coralSoft: string;
  tabBar: string;
  tabBarBorder: string;
  tabInactive: string;
  messageResidentBg: string;
  messageResidentBorder: string;
  messageMgmtCoralBg: string;
  messageMgmtCoralBorder: string;
  messageMgmtSkyBg: string;
  messageMgmtSkyBorder: string;
  messageMgmtSkyText: string;
  inputBg: string;
  statusBarStyle: 'light' | 'dark';
};

export const lightThemeColors: ThemeColors = {
  bg: '#FFF8F6',
  fg: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  cardBorder: '#F1E8E4',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  coral: '#FF5A5F',
  coralSoft: '#FFF1F0',
  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(17, 24, 39, 0.08)',
  tabInactive: '#717171',
  messageResidentBg: '#FAFAF9',
  messageResidentBorder: '#E7E5E4',
  messageMgmtCoralBg: '#FFF1F0',
  messageMgmtCoralBorder: '#FFB1A8',
  messageMgmtSkyBg: '#F0F9FF',
  messageMgmtSkyBorder: '#BAE6FD',
  messageMgmtSkyText: '#0C4A6E',
  inputBg: '#FFFFFF',
  statusBarStyle: 'dark',
};

export const darkThemeColors: ThemeColors = {
  bg: '#0B1727',
  fg: '#F3F4F6',
  /** Slightly lifted from web --sr-muted for ~4.5:1+ on card/navy surfaces. */
  muted: '#B0B8C4',
  border: '#1F2937',
  cardBorder: '#243244',
  card: '#142235',
  surface: '#142235',
  coral: '#FF6F60',
  coralSoft: '#6E1B1F',
  tabBar: '#142235',
  tabBarBorder: 'rgba(243, 244, 246, 0.08)',
  tabInactive: '#B0B8C4',
  messageResidentBg: '#1C1917',
  messageResidentBorder: '#44403C',
  messageMgmtCoralBg: '#6E1B1F',
  messageMgmtCoralBorder: '#B92F35',
  messageMgmtSkyBg: '#0C2340',
  messageMgmtSkyBorder: '#0369A1',
  messageMgmtSkyText: '#BAE6FD',
  inputBg: '#0B1727',
  statusBarStyle: 'light',
};

export function themeColorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkThemeColors : lightThemeColors;
}
