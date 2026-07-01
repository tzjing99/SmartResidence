import { MotiView } from 'moti';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { palette, radius, spring } from '../tokens';
import { textBase, typography } from '../typography';

export interface ButtonProps extends PressableProps {
  variant?: 'primary' | 'soft-primary' | 'soft-sky' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  title: string;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  title,
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = React.useState(false);
  const heights = { sm: 36, md: 44, lg: 52 };
  const textVariants = { sm: typography.bodySm, md: typography.body, lg: typography.subheading };

  const palettes: Record<
    NonNullable<ButtonProps['variant']>,
    { bg: string; fg: string; border?: string }
  > = {
    primary: { bg: palette.coralPrimary, fg: '#FFFFFF' },
    'soft-primary': {
      bg: palette.messageMgmtCoralBg,
      fg: palette.coralPrimary,
      border: palette.messageMgmtCoralBorder,
    },
    'soft-sky': {
      bg: palette.messageMgmtSkyBg,
      fg: palette.messageMgmtSkyText,
      border: palette.messageMgmtSkyBorder,
    },
    secondary: { bg: palette.surfaceLight, fg: palette.textLight, border: palette.borderLight },
    ghost: { bg: 'transparent', fg: palette.textLight },
    destructive: { bg: '#EF4444', fg: '#FFFFFF' },
  };
  const p = palettes[variant];

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
      style={({ pressed: _pressed }) => style as ViewStyle | undefined}
      {...props}
    >
      <MotiView
        animate={{ scale: !reduceMotion && pressed ? 0.97 : 1 }}
        transition={spring.snappy}
        style={{
          height: heights[size],
          paddingHorizontal: 20,
          borderRadius: radius.xl,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          opacity: disabled || loading ? 0.7 : 1,
        }}
      >
        {loading ? <ActivityIndicator size="small" color={p.fg} /> : null}
        <Text
          style={{
            ...textBase,
            ...textVariants[size],
            color: p.fg,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      </MotiView>
    </Pressable>
  );
};
