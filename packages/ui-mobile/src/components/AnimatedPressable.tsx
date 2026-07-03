import { MotiView } from 'moti';
import * as React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { spring } from '../tokens';

const MIN_TOUCH_TARGET = 44;

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Pressable with iOS-like scale feedback (same on Android). */
export function AnimatedPressable({
  children,
  style,
  contentStyle,
  disabled,
  accessibilityRole,
  onPress,
  ...props
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = React.useState(false);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
      accessibilityRole={accessibilityRole ?? (onPress ? 'button' : undefined)}
      {...props}
    >
      <MotiView
        animate={{ scale: !reduceMotion && pressed && !disabled ? 0.97 : 1 }}
        transition={spring.snappy}
        style={[{ minHeight: onPress ? MIN_TOUCH_TARGET : undefined }, contentStyle]}
      >
        {children}
      </MotiView>
    </Pressable>
  );
}
