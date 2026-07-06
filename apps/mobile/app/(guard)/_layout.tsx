import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { useT } from '../../src/i18n/locale-provider';
import { TabBarIcon, useModernTabBarOptions } from '../../src/lib/modern-tab-bar';

export default function GuardLayout() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tabBarOptions = useModernTabBarOptions(insets.bottom);

  return (
    <RoleGuardGate area="guard">
      <Tabs
        screenOptions={{
          headerShown: false,
          ...tabBarOptions,
        }}
      >
        <Tabs.Screen
          name="scan"
          options={{
            title: t('mobile.guard.tabs.scan'),
            tabBarAccessibilityLabel: t('mobile.guard.tabs.scan'),
            tabBarIcon: ({ color }) => <TabBarIcon name="qr-code-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            title: t('mobile.guard.tabs.live'),
            tabBarAccessibilityLabel: t('mobile.guard.tabs.live'),
            tabBarIcon: ({ color }) => <TabBarIcon name="radio-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="expected"
          options={{
            title: t('mobile.guard.tabs.expected'),
            tabBarAccessibilityLabel: t('mobile.guard.tabs.expected'),
            tabBarIcon: ({ color }) => <TabBarIcon name="list-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="walkin"
          options={{
            title: t('mobile.guard.tabs.walkIn'),
            tabBarAccessibilityLabel: t('mobile.guard.tabs.walkIn'),
            tabBarIcon: ({ color }) => <TabBarIcon name="person-add-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('mobile.guard.tabs.more'),
            tabBarAccessibilityLabel: t('mobile.guard.tabs.more'),
            tabBarIcon: ({ color }) => <TabBarIcon name="ellipsis-horizontal" color={color} />,
          }}
        />
        <Tabs.Screen name="patrol" options={{ href: null }} />
        <Tabs.Screen name="alerts" options={{ href: null }} />
        <Tabs.Screen name="manual" options={{ href: null }} />
        <Tabs.Screen name="parcels" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </RoleGuardGate>
  );
}
