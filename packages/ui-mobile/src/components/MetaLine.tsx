import type * as React from 'react';
import { View, type ViewStyle } from 'react-native';
import { typography } from '../typography';
import { AppText } from './Text';

const SEP = '·';

export interface MetaLineProps {
  parts: React.ReactNode[];
  style?: ViewStyle;
}

/** Single-baseline meta row: "Name · time · count" with consistent separator spacing. */
export const MetaLine: React.FC<MetaLineProps> = ({ parts, style }) => {
  const visible = parts.filter((p) => p !== null && p !== undefined && p !== '');
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, style]}>
      {visible.map((part, i) => (
        <View
          key={typeof part === 'string' || typeof part === 'number' ? `${part}-${i}` : `meta-${i}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          {i > 0 ? (
            <AppText
              variant="meta"
              style={{ opacity: 0.5, lineHeight: typography.meta.lineHeight }}
            >
              {SEP}
            </AppText>
          ) : null}
          {typeof part === 'string' || typeof part === 'number' ? (
            <AppText variant="meta">{part}</AppText>
          ) : (
            part
          )}
        </View>
      ))}
    </View>
  );
};
