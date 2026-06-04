export const palette = {
  coralPrimary: '#FF5A5F',
  coralPrimaryDark: '#E04147',
  navy: '#1F3148',
  navyMuted: '#5E7A9E',
  bgLight: '#FAFAFA',
  bgDark: '#0B1727',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#142235',
  borderLight: '#E5E7EB',
  borderDark: '#1F2937',
  textLight: '#111827',
  textDark: '#F3F4F6',
  mutedLight: '#6B7280',
  mutedDark: '#9CA3AF',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const spring = {
  default: { damping: 22, stiffness: 320, mass: 1 },
  gentle: { damping: 26, stiffness: 200, mass: 1 },
  snappy: { damping: 30, stiffness: 480, mass: 1 },
} as const;
