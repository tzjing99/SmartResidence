import type { TextStyle } from 'react-native';
import { palette } from './tokens';

/** Android extra font padding causes vertical misalignment — disable globally. */
export const textBase: Pick<TextStyle, 'textAlign' | 'includeFontPadding'> = {
  textAlign: 'left',
  includeFontPadding: false,
};

export type TypographyVariant =
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'meta'
  | 'caption';

export const typography: Record<TypographyVariant, TextStyle> = {
  title: {
    ...textBase,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: palette.textLight,
  },
  heading: {
    ...textBase,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: palette.textLight,
  },
  subheading: {
    ...textBase,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: palette.textLight,
  },
  body: {
    ...textBase,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: palette.textLight,
  },
  bodySm: {
    ...textBase,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: palette.textLight,
  },
  label: {
    ...textBase,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textLight,
  },
  meta: {
    ...textBase,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: palette.mutedLight,
  },
  caption: {
    ...textBase,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: palette.mutedLight,
  },
};
