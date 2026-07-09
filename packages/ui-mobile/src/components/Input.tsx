import * as React from 'react';
import { TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { FONT_SCALE, scaledLineHeight } from '../font-scaling';
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

export const Input = React.forwardRef<TextInput, TextInputProps>(
  (
    { style, allowFontScaling = true, maxFontSizeMultiplier = FONT_SCALE.control, ...props },
    ref,
  ) => {
    const { colors } = useTheme();
    const fontCap = maxFontSizeMultiplier ?? FONT_SCALE.control;
    return (
      <TextInput
        ref={ref}
        allowFontScaling={allowFontScaling}
        maxFontSizeMultiplier={fontCap}
        placeholderTextColor={colors.muted}
        style={[
          {
            ...textBase,
            minHeight: 44,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.xl,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: typography.bodySm.fontSize,
            lineHeight: scaledLineHeight(typography.bodySm.lineHeight, fontCap),
            color: colors.fg,
            backgroundColor: colors.inputBg,
          },
          style,
        ]}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
