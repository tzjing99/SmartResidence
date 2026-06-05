import * as React from 'react';
import { TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { palette, radius } from '../tokens';
import { textBase, typography } from '../typography';
import { AppText } from './Text';

const inputStyle = {
  ...textBase,
  height: 44,
  borderWidth: 1,
  borderColor: palette.borderLight,
  borderRadius: radius.xl,
  paddingHorizontal: 12,
  fontSize: typography.bodySm.fontSize,
  lineHeight: typography.bodySm.lineHeight,
  color: palette.textLight,
  backgroundColor: palette.surfaceLight,
} as const;

export interface FieldProps {
  label?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, containerStyle, children }) => (
  <View style={[{ gap: 4 }, containerStyle]}>
    {label ? <AppText variant="label">{label}</AppText> : null}
    {children}
    {hint ? <AppText variant="meta">{hint}</AppText> : null}
  </View>
);

export const Input = React.forwardRef<TextInput, TextInputProps>(({ style, ...props }, ref) => (
  <TextInput
    ref={ref}
    placeholderTextColor={palette.mutedLight}
    style={[inputStyle, style]}
    {...props}
  />
));
Input.displayName = 'Input';
