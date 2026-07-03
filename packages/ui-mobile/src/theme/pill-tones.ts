import { type ThemeMode } from './colors';

export type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type PillToneStyle = { bg: string; fg: string };

/** Semantic pill colors — mirrors web Badge tones for light and dark mode. */
const lightPillTones: Record<PillTone, PillToneStyle> = {
  neutral: { bg: '#F3F4F6', fg: '#374151' },
  primary: { bg: '#FFF1F0', fg: '#C2410C' },
  success: { bg: '#D1FAE5', fg: '#047857' },
  warning: { bg: '#FEF3C7', fg: '#B45309' },
  danger: { bg: '#FEE2E2', fg: '#B91C1C' },
  info: { bg: '#E0F2FE', fg: '#075985' },
};

const darkPillTones: Record<PillTone, PillToneStyle> = {
  neutral: { bg: 'rgba(41, 47, 55, 0.5)', fg: '#D1D5DB' },
  primary: { bg: 'rgba(110, 27, 31, 0.4)', fg: '#FCA5A5' },
  success: { bg: 'rgba(6, 78, 59, 0.3)', fg: '#34D399' },
  warning: { bg: 'rgba(120, 53, 15, 0.3)', fg: '#FBBF24' },
  danger: { bg: 'rgba(127, 29, 29, 0.3)', fg: '#F87171' },
  info: { bg: 'rgba(12, 74, 110, 0.3)', fg: '#7DD3FC' },
};

export function pillToneStylesForMode(mode: ThemeMode): Record<PillTone, PillToneStyle> {
  return mode === 'dark' ? darkPillTones : lightPillTones;
}
