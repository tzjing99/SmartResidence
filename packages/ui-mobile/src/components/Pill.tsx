import type * as React from 'react';
import { Text, View } from 'react-native';
import { type PillTone, pillToneStylesForMode } from '../theme/pill-tones';
import { useTheme } from '../theme/theme-provider';
import { radius } from '../tokens';
import { textBase, typography } from '../typography';

export type { PillTone };

export const Pill: React.FC<{ tone?: PillTone; label: string }> = ({ tone = 'neutral', label }) => {
  const { resolvedMode } = useTheme();
  const s = pillToneStylesForMode(resolvedMode)[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        minHeight: 24,
        paddingHorizontal: 10,
        justifyContent: 'center',
        backgroundColor: s.bg,
        borderRadius: radius.full,
      }}
    >
      <Text
        style={{
          ...textBase,
          ...typography.meta,
          color: s.fg,
          fontWeight: '600',
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
