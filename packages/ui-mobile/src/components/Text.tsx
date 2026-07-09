import type * as React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  StyleSheet,
  type TextStyle,
} from 'react-native';
import { FONT_SCALE, scaledLineHeight } from '../font-scaling';
import { useTheme } from '../theme';
import { type TypographyVariant, typography } from '../typography';

export interface AppTextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
  /**
   * Cap for OS Dynamic Type / Android font scale.
   * Defaults to {@link FONT_SCALE.body} (2.0). Pass a lower tier for chrome.
   */
  maxFontSizeMultiplier?: number;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  muted = false,
  style,
  children,
  allowFontScaling = true,
  maxFontSizeMultiplier = FONT_SCALE.body,
  ...props
}) => {
  const { colors } = useTheme();
  const base = typography[variant];
  const colorStyle: TextStyle = { color: muted ? colors.muted : colors.fg };
  const flat = StyleSheet.flatten([base, colorStyle, style]) as TextStyle;
  const { lineHeight, ...rest } = flat;
  const resolvedStyle: TextStyle = {
    ...rest,
    lineHeight: scaledLineHeight(
      typeof lineHeight === 'number' ? lineHeight : undefined,
      maxFontSizeMultiplier,
    ),
  };

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={resolvedStyle}
      {...props}
    >
      {children}
    </RNText>
  );
};
