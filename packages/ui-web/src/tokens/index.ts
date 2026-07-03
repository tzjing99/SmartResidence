/**
 * SmartResidence design tokens. Inspired by AirBnB's warm, soft palette but
 * tuned for a community/property context: a coral primary that feels welcoming,
 * a deep navy for high-contrast text, and surfaces that lean almost-white in
 * light mode and almost-black in dark mode.
 */
export const palette = {
  coral: {
    50: '#FFF1F0',
    100: '#FFD7D3',
    200: '#FFB1A8',
    300: '#FF8A7C',
    400: '#FF6F60',
    500: '#FF5A5F',
    600: '#E04147',
    700: '#B92F35',
    800: '#922428',
    900: '#6E1B1F',
    950: '#4C1316',
  },
  navy: {
    50: '#F1F4F8',
    100: '#D9E0EA',
    200: '#B3C2D5',
    300: '#8DA3C0',
    400: '#5E7A9E',
    500: '#3F5A82',
    600: '#2E4565',
    700: '#1F3148',
    800: '#142235',
    900: '#0B1727',
  },
  ink: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  success: { 500: '#10B981', 600: '#0F9F70' },
  warning: { 500: '#F59E0B', 600: '#D88A07' },
  danger: { 500: '#EF4444', 600: '#D43E3E' },
} as const;

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px',
} as const;

export const shadow = {
  card: '0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
  hover: '0 12px 32px -8px rgb(0 0 0 / 0.12), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
  modal: '0 24px 48px -12px rgb(0 0 0 / 0.18)',
} as const;

// Animation spring presets live in `./motion` (`iosSpring`) — that is the
// single source of truth for framer-motion transitions across the web app.
