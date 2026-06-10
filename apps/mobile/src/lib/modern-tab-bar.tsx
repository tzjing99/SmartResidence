import type { ComponentProps, ReactNode } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
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
  [key: string]: unknown;
};

const ACTIVE_TINT = '#FF385C'; // Airbnb pink
const INACTIVE_TINT = '#717171'; // Modern grey
/** Matches resident/guard screen shells — avoids default RN tab navigator grey. */
export const TAB_SCENE_BACKGROUND = '#FFF8F6';
/** Solid, opaque bar surface for a clean, consistent look. */
const TAB_BAR_SURFACE = '#FFFFFF';
const TAB_BAR_BORDER = 'rgba(17, 24, 39, 0.08)'; // Very subtle, clean border

export function createModernTabBarOptions(bottomInset: number) {
  // Total height includes the active content area plus the bottom safe area inset.
  const totalHeight = TAB_BAR_ACTIVE_HEIGHT + bottomInset;

  return {
    tabBarActiveTintColor: ACTIVE_TINT,
    tabBarInactiveTintColor: INACTIVE_TINT,
    tabBarAllowFontScaling: false,
    tabBarButton: ModernTabBarButton,
    tabBarLabelStyle: styles.label,
    tabBarIconStyle: styles.icon,
    tabBarItemStyle: styles.item,
    // Disable automatic safe area insets so we can control height and padding precisely
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
  const { style, onPress, ...rest } = props;

  const handlePress = (e: GestureResponderEvent) => {
    hapticLight();
    onPress?.(e);
  };

  return (
    <Pressable
      {...(rest as ComponentProps<typeof Pressable>)}
      onPress={handlePress}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TAB_BAR_BORDER,
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0, // Remove shadow for a clean flat docked look
  },
  item: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
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
