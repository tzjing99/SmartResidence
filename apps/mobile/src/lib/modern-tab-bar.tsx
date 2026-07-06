import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@smartresidence/ui-mobile';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';
import {
  type AccessibilityRole,
  type GestureResponderEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { minTouchTargetStyle } from './accessibility';
import { hapticLight } from './haptics';

/**
 * Height of the active content area of the tab bar (excluding safe area).
 * 52px is the perfect height for a premium, compact bottom tab bar.
 */
const TAB_BAR_ACTIVE_HEIGHT = 52;
const ICON_LABEL_GAP = 3;

/** Wide props so the handler satisfies React Navigation's tabBarButton signature. */
type TabBarButtonProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  accessibilityLabel?: string;
  [key: string]: unknown;
};

/** @deprecated Use `useTheme().colors.bg` instead. */
export const TAB_SCENE_BACKGROUND = '#FFF8F6';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function TabBarIcon({ name, color }: { name: IoniconName; color: string }) {
  return (
    <Ionicons
      name={name}
      size={22}
      color={color}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}

export function useModernTabBarOptions(bottomInset: number) {
  const { colors } = useTheme();
  const totalHeight = TAB_BAR_ACTIVE_HEIGHT + bottomInset;

  return useMemo(
    () => ({
      tabBarActiveTintColor: colors.coral,
      tabBarInactiveTintColor: colors.tabInactive,
      tabBarAllowFontScaling: false,
      tabBarButton: ModernTabBarButton,
      tabBarLabelStyle: styles.label,
      tabBarIconStyle: styles.icon,
      tabBarItemStyle: styles.item,
      safeAreaInsets: { bottom: 0, top: 0, left: 0, right: 0 },
      sceneStyle: {
        backgroundColor: colors.bg,
      },
      tabBarStyle: [
        styles.tabBar,
        {
          height: totalHeight,
          paddingBottom: bottomInset,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
      ],
    }),
    [
      bottomInset,
      colors.bg,
      colors.coral,
      colors.tabBar,
      colors.tabBarBorder,
      colors.tabInactive,
      totalHeight,
    ],
  );
}

/** @deprecated Use `useModernTabBarOptions` for theme-aware tab styling. */
export function createModernTabBarOptions(bottomInset: number) {
  const totalHeight = TAB_BAR_ACTIVE_HEIGHT + bottomInset;

  return {
    tabBarActiveTintColor: '#FF5A5F',
    tabBarInactiveTintColor: '#717171',
    tabBarAllowFontScaling: false,
    tabBarButton: ModernTabBarButton,
    tabBarLabelStyle: styles.label,
    tabBarIconStyle: styles.icon,
    tabBarItemStyle: styles.item,
    safeAreaInsets: { bottom: 0, top: 0, left: 0, right: 0 },
    sceneStyle: {
      backgroundColor: TAB_SCENE_BACKGROUND,
    },
    tabBarStyle: [
      styles.tabBar,
      {
        height: totalHeight,
        paddingBottom: bottomInset,
      },
    ],
  };
}

function ModernTabBarButton(props: TabBarButtonProps) {
  const { style, onPress, accessibilityRole, ...rest } = props;

  return (
    <Pressable
      {...(rest as ComponentProps<typeof Pressable>)}
      accessibilityRole={accessibilityRole ?? 'tab'}
      onPress={(e) => {
        hapticLight();
        onPress?.(e);
      }}
      style={[minTouchTargetStyle, style]}
    />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 44,
  },
  icon: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ICON_LABEL_GAP,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '600',
    includeFontPadding: false,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
});
