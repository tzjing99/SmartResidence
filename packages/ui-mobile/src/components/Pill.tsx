import type * as React from 'react';
import { Text, View } from 'react-native';
import { palette, radius } from '../tokens';
import { textBase, typography } from '../typography';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#F3F4F6', fg: '#374151' },
  primary: { bg: '#FFE2DF', fg: palette.coralPrimary },
  success: { bg: '#D1FAE5', fg: '#047857' },
  warning: { bg: '#FEF3C7', fg: '#B45309' },
  danger: { bg: '#FEE2E2', fg: '#B91C1C' },
  info: { bg: '#E0F2FE', fg: '#075985' },
};

export const Pill: React.FC<{ tone?: Tone; label: string }> = ({ tone = 'neutral', label }) => {
  const s = toneStyles[tone];
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
