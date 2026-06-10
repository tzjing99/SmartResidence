import { MotiView } from 'moti';
import * as React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { spring } from '../tokens';

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
  ...props
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = React.useState(false);

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
      {...props}
    >
      <MotiView
        animate={{ scale: !reduceMotion && pressed && !disabled ? 0.97 : 1 }}
        transition={spring.snappy}
        style={contentStyle}
      >
        {children as never}
      </MotiView>
    </Pressable>
  );
}
