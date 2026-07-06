import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { TabBarIcon, useModernTabBarOptions } from '../../src/lib/modern-tab-bar';

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
            tabBarAccessibilityLabel: 'Home tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
            title: 'Visitors',
            tabBarAccessibilityLabel: 'Visitors tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="people-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: 'Fees',
            tabBarAccessibilityLabel: 'Fees tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="card-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="defects"
          options={{
            title: 'Defects',
            tabBarAccessibilityLabel: 'Defects tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="construct-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarAccessibilityLabel: 'Messages tab',
            tabBarIcon: ({ color }) => <TabBarIcon name="chatbubbles-outline" color={color} />,
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
            tabBarAccessibilityLabel: 'More tab',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="ellipsis-horizontal" color={color} />
            ),
          }}
        />
      </Tabs>
    </RoleGuardGate>
  );
}
