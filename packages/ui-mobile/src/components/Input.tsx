import * as React from 'react';
import { TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { radius } from '../tokens';
import { textBase, typography } from '../typography';
import { AppText } from './Text';

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

export const Input = React.forwardRef<TextInput, TextInputProps>(({ style, ...props }, ref) => {
  const { colors } = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.muted}
      style={[
        {
          ...textBase,
          height: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.xl,
          paddingHorizontal: 12,
          fontSize: typography.bodySm.fontSize,
          lineHeight: typography.bodySm.lineHeight,
          color: colors.fg,
          backgroundColor: colors.inputBg,
        },
        style,
      ]}
      {...props}
    />
  );
});
Input.displayName = 'Input';
