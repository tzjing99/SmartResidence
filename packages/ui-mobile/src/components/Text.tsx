import type * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { type TypographyVariant, typography } from '../typography';

export interface AppTextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  muted = false,
  style,
  children,
  ...props
}) => {
  const base = typography[variant];
  const colorStyle: TextStyle | undefined = muted ? { color: typography.meta.color } : undefined;
  return (
    <RNText style={[base, colorStyle, style]} {...props}>
      {children}
    </RNText>
  );
};
