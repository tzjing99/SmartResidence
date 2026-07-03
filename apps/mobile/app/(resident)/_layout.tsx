import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { useT } from '../../src/i18n/locale-provider';
import { createModernTabBarOptions } from '../../src/lib/modern-tab-bar';

export default function ResidentTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarOptions = createModernTabBarOptions(insets.bottom);
  const t = useT();

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
            title: t('nav.home'),
            tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
            title: t('nav.visitors'),
            tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: t('nav.billing'),
            tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="defects"
          options={{
            title: t('nav.defects'),
            tabBarIcon: ({ color }) => (
              <Ionicons name="construct-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t('nav.messages'),
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
        <Tabs.Screen
          name="settings"
          options={{
            title: t('nav.settings'),
            tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: t('nav.activity'),
            tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={22} color={color} />,
          }}
        />
      </Tabs>
    </RoleGuardGate>
  );
}
