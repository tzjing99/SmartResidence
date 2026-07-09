import type * as React from 'react';
import { Text, View } from 'react-native';
import { FONT_SCALE, scaledLineHeight } from '../font-scaling';
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
        paddingVertical: 4,
        justifyContent: 'center',
        backgroundColor: s.bg,
        borderRadius: radius.full,
        maxWidth: '100%',
      }}
    >
      <Text
        allowFontScaling
        maxFontSizeMultiplier={FONT_SCALE.control}
        style={{
          ...textBase,
          ...typography.meta,
          lineHeight: scaledLineHeight(typography.meta.lineHeight, FONT_SCALE.control),
          color: s.fg,
          fontWeight: '600',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
