import { MotiView } from 'moti';
import * as React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme';
import { radius } from '../tokens';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Shimmering placeholder block — respects reduced motion (static grey instead of pulsing). */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  radius: r = radius.sm,
  style,
}) => {
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();

  if (reduceMotion) {
    return (
      <View
        style={[{ width, height, borderRadius: r, backgroundColor: colors.cardBorder }, style]}
      />
    );
  }

  return (
    <MotiView
      style={[{ width, height, borderRadius: r, backgroundColor: colors.cardBorder }, style]}
      from={{ opacity: 0.45 }}
      animate={{ opacity: 0.9 }}
      transition={{
        type: 'timing',
        duration: 900,
        loop: true,
        repeatReverse: true,
      }}
    />
  );
};

/** Stack of skeleton rows mimicking a list of cards — use while a query is loading. */
export const SkeletonList: React.FC<{ rows?: number; rowHeight?: number; gap?: number }> = ({
  rows = 3,
  rowHeight = 76,
  gap = 12,
}) => (
  <View style={{ gap }}>
    {Array.from({ length: rows }, (_, i) => `skeleton-row-${i}`).map((key) => (
      <Skeleton key={key} height={rowHeight} radius={radius['2xl']} />
    ))}
  </View>
);
