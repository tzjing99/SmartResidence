import type * as React from 'react';
import { View, type ViewProps } from 'react-native';

/** Label/value row with vertically centered content (iOS settings cell rhythm). */
export const AlignRow: React.FC<ViewProps & { minHeight?: number; gap?: number }> = ({
  minHeight = 36,
  gap = 12,
  style,
  children,
  ...props
}) => (
  <View
    style={[
      {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight,
        gap,
      },
      style,
    ]}
    {...props}
  >
    {children}
  </View>
);
