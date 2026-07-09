import { MotiView } from 'moti';
import * as React from 'react';
import { Pressable, type PressableProps, Text } from 'react-native';
import { FONT_SCALE, scaledLineHeight } from '../font-scaling';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { palette, radius, spring } from '../tokens';

export interface ChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  active?: boolean;
  tone?: 'coral' | 'navy';
}

/** Filter / segment pill — the single source of truth for chip styling across screens. */
export const Chip: React.FC<ChipProps> = ({ label, active = false, tone = 'coral', ...props }) => {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = React.useState(false);
  const activeBg = tone === 'coral' ? palette.coralPrimary : palette.navy;

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      {...props}
    >
      <MotiView
        animate={{ scale: !reduceMotion && pressed ? 0.96 : 1 }}
        transition={spring.snappy}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          minHeight: 34,
          borderRadius: radius.full,
          backgroundColor: active ? activeBg : palette.surfaceLight,
          borderWidth: 1,
          borderColor: active ? activeBg : palette.borderLight,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          allowFontScaling
          maxFontSizeMultiplier={FONT_SCALE.control}
          style={{
            fontSize: 13,
            lineHeight: scaledLineHeight(18, FONT_SCALE.control),
            fontWeight: '600',
            color: active ? '#FFFFFF' : palette.mutedLight,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </MotiView>
    </Pressable>
  );
};
