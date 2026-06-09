import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { createModernTabBarOptions } from '../../src/lib/modern-tab-bar';

export default function GuardLayout() {
  const insets = useSafeAreaInsets();
  const tabBarOptions = createModernTabBarOptions(insets.bottom);

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
            title: 'Scan',
            tabBarIcon: ({ color }) => (
              <Ionicons name="qr-code-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            title: 'On site',
            tabBarIcon: ({ color }) => (
              <Ionicons name="radio-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="expected"
          options={{
            title: 'Expected',
            tabBarIcon: ({ color }) => (
              <Ionicons name="list-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="manual"
          options={{
            title: 'Manual',
            tabBarIcon: ({ color }) => (
              <Ionicons name="create-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="walkin"
          options={{
            title: 'Walk-in',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-add-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </RoleGuardGate>
  );
}
