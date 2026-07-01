import { MotiView } from 'moti';
import type * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { spring } from '../tokens';

export interface FadeInViewProps {
  children: React.ReactNode;
  /** Stagger index on first mount (capped internally). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fade + slight rise on mount; respects reduced motion. */
export function FadeInView({ children, index = 0, style }: FadeInViewProps) {
  const reduceMotion = useReducedMotion();
  const delay = Math.min(index, 6) * 35;

  if (reduceMotion) {
    return <MotiView style={style}>{children}</MotiView>;
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ ...spring.snappy, delay }}
      style={style}
    >
      {children}
    </MotiView>
  );
}
