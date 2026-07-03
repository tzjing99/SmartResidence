import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
<<<<<<< HEAD
import { useT } from '../../src/i18n/locale-provider';
import { useModernTabBarOptions } from '../../src/lib/modern-tab-bar';
=======
import { TabBarIcon, createModernTabBarOptions } from '../../src/lib/modern-tab-bar';
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)

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
<<<<<<< HEAD
            title: t('mobile.guard.tabs.scan'),
            tabBarIcon: ({ color }) => <Ionicons name="qr-code-outline" size={22} color={color} />,
=======
            title: 'Scan',
            tabBarAccessibilityLabel: 'Scan tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="qr-code-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
<<<<<<< HEAD
            title: t('mobile.guard.tabs.live'),
            tabBarIcon: ({ color }) => <Ionicons name="radio-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="expected"
          options={{
            title: t('mobile.guard.tabs.expected'),
            tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="walkin"
          options={{
            title: t('mobile.guard.tabs.walkIn'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-add-outline" size={22} color={color} />
            ),
=======
            title: 'On site',
            tabBarAccessibilityLabel: 'On site tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="radio-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="patrol"
          options={{
            title: 'Patrol',
            tabBarAccessibilityLabel: 'Patrol tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="shield-checkmark-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarAccessibilityLabel: 'Alerts tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="alert-circle-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="expected"
          options={{
            title: 'Expected',
            tabBarAccessibilityLabel: 'Expected tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="list-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="manual"
          options={{
            title: 'Manual',
            tabBarAccessibilityLabel: 'Manual tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="create-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="walkin"
          options={{
            title: 'Walk-in',
            tabBarAccessibilityLabel: 'Walk-in tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="person-add-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
<<<<<<< HEAD
            title: t('mobile.guard.tabs.more'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="ellipsis-horizontal" size={22} color={color} />
            ),
=======
            title: 'Parcels',
            tabBarAccessibilityLabel: 'Parcels tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="cube-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarAccessibilityLabel: 'Settings tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="settings-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
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
