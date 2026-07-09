import { MotiView } from 'moti';
import type * as React from 'react';
import { Text, View } from 'react-native';
import { FONT_SCALE, scaledLineHeight } from '../font-scaling';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme';
import { radius, spring } from '../tokens';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => {
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();
  return (
    <MotiView
      from={reduceMotion ? undefined : { opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={spring.gentle}
      style={{
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.cardBorder,
        padding: 32,
        alignItems: 'center',
        gap: 12,
      }}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        allowFontScaling
        maxFontSizeMultiplier={FONT_SCALE.body}
        style={{
          fontSize: 17,
          lineHeight: scaledLineHeight(22, FONT_SCALE.body),
          fontWeight: '600',
          color: colors.fg,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          allowFontScaling
          maxFontSizeMultiplier={FONT_SCALE.body}
          style={{
            textAlign: 'center',
            color: colors.muted,
            fontSize: 14,
            lineHeight: scaledLineHeight(20, FONT_SCALE.body),
          }}
        >
          {description}
        </Text>
      ) : null}
      {action}
    </MotiView>
  );
};
