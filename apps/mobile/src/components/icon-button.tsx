import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@smartresidence/ui-mobile';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { minTouchTargetStyle } from '../lib/accessibility';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type IconButtonProps = {
  name: IoniconName;
  label: string;
  color: string;
  size?: number;
  onPress: () => void;
};

/** Icon-only control with screen-reader label and 44pt touch target. */
export function IconButton({ name, label, color, size = 22, onPress }: IconButtonProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      contentStyle={styles.hitArea}
    >
      <Ionicons
        name={name}
        size={size}
        color={color}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    ...minTouchTargetStyle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
