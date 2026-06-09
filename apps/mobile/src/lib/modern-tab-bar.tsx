import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { palette, radius } from '@smartresidence/ui-mobile';

const ACTIVE_TINT = '#FF385C';
const INACTIVE_TINT = '#717171';
const TAB_BAR_SURFACE = 'rgba(255, 255, 255, 0.88)';
const TAB_BAR_BORDER = 'rgba(17, 24, 39, 0.08)';

export function createModernTabBarOptions(bottomInset: number) {
  const safePadding = Math.max(bottomInset, 10);

  return {
    tabBarActiveTintColor: ACTIVE_TINT,
    tabBarInactiveTintColor: INACTIVE_TINT,
    tabBarAllowFontScaling: false,
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
    tabBarStyle: [
      styles.tabBar,
      {
        height: 58 + safePadding,
        paddingBottom: safePadding,
      },
    ],
    tabBarBackground: () =>
      Platform.OS === 'ios' ? (
        <BlurView intensity={38} tint="light" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.androidSurface} />
      ),
  };
}

const styles = StyleSheet.create({
  tabBar: {
    marginHorizontal: 10,
    marginBottom: 8,
    paddingTop: 7,
    backgroundColor: TAB_BAR_SURFACE,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: TAB_BAR_BORDER,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  androidSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.surfaceLight,
  },
  item: {
    minWidth: 0,
    paddingVertical: 2,
  },
  label: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    includeFontPadding: false,
    marginTop: 1,
  },
});
