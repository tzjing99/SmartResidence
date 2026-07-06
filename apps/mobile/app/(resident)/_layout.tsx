import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { useModernTabBarOptions } from '../../src/lib/modern-tab-bar';

export default function ResidentTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarOptions = useModernTabBarOptions(insets.bottom);

  return (
    <RoleGuardGate area="resident">
      <Tabs
        screenOptions={{
          headerShown: false,
          ...tabBarOptions,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
            title: 'Visitors',
            tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: 'Fees',
            tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="defects"
          options={{
            title: 'Defects',
            tabBarIcon: ({ color }) => (
              <Ionicons name="construct-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubbles-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="announcements"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="polls" options={{ href: null }} />
        <Tabs.Screen name="governance" options={{ href: null }} />
        <Tabs.Screen name="facilities" options={{ href: null }} />
        <Tabs.Screen name="forms" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="parcels" options={{ href: null }} />
        <Tabs.Screen name="lost-found" options={{ href: null }} />
        <Tabs.Screen name="faq" options={{ href: null }} />
        <Tabs.Screen name="access" options={{ href: null }} />
        <Tabs.Screen name="sos" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="activity" options={{ href: null }} />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => (
              <Ionicons name="ellipsis-horizontal" size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </RoleGuardGate>
  );
}
