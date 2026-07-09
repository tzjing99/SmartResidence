import { PixelRatio } from 'react-native';

/**
 * System Dynamic Type / Android font-scale policy for ui-mobile.
 *
 * Default: FOLLOW the OS (`allowFontScaling` stays true). We never disable
 * scaling globally. Caps exist only where chrome would otherwise clip or
 * overflow (tab bar, buttons, chips).
 *
 * | Tier        | maxFontSizeMultiplier | Use |
 * |-------------|----------------------|-----|
 * | body        | 2.0                  | AppText body/titles, forms, cards, settings copy |
 * | control     | 1.5                  | Button, Input, Chip, Pill labels |
 * | chrome      | 1.35                 | Tab bar labels and other fixed chrome |
 *
 * React Native scales `fontSize` via `allowFontScaling` but does **not**
 * scale `lineHeight`. Use `scaledLineHeight` whenever a style sets lineHeight
 * so large text is not clipped.
 */
export const FONT_SCALE = {
  /** Body / content — elderly / low-vision friendly. */
  body: 2.0,
  /** Interactive controls that share a row or fixed chrome. */
  control: 1.5,
  /** Tab bar and similarly tight chrome. */
  chrome: 1.35,
} as const;

export type FontScaleTier = keyof typeof FONT_SCALE;

/** Effective font scale, capped to the given multiplier (matches Text capping). */
export function cappedFontScale(maxMultiplier: number = FONT_SCALE.body): number {
  return Math.min(PixelRatio.getFontScale(), maxMultiplier);
}

/** Scale a design-token lineHeight with the (capped) system font scale. */
export function scaledLineHeight(
  lineHeight: number | undefined,
  maxMultiplier: number = FONT_SCALE.body,
): number | undefined {
  if (lineHeight == null) return undefined;
  return Math.round(lineHeight * cappedFontScale(maxMultiplier));
}
