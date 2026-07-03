import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
<<<<<<< HEAD
import { useModernTabBarOptions } from '../../src/lib/modern-tab-bar';
=======
import { useT } from '../../src/i18n/locale-provider';
import { TabBarIcon, createModernTabBarOptions } from '../../src/lib/modern-tab-bar';
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)

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
<<<<<<< HEAD
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
=======
            title: t('nav.home'),
            tabBarAccessibilityLabel: `${t('nav.home')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
<<<<<<< HEAD
            title: 'Visitors',
            tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
=======
            title: t('nav.visitors'),
            tabBarAccessibilityLabel: `${t('nav.visitors')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="people-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
<<<<<<< HEAD
            title: 'Fees',
            tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={22} color={color} />,
=======
            title: t('nav.billing'),
            tabBarAccessibilityLabel: `${t('nav.billing')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="card-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="defects"
          options={{
<<<<<<< HEAD
            title: 'Defects',
            tabBarIcon: ({ color }) => (
              <Ionicons name="construct-outline" size={22} color={color} />
            ),
=======
            title: t('nav.defects'),
            tabBarAccessibilityLabel: `${t('nav.defects')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="construct-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
<<<<<<< HEAD
            title: 'Messages',
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubbles-outline" size={22} color={color} />
            ),
=======
            title: t('nav.messages'),
            tabBarAccessibilityLabel: `${t('nav.messages')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="chatbubbles-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
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
<<<<<<< HEAD
            title: 'More',
            tabBarIcon: ({ color }) => (
              <Ionicons name="ellipsis-horizontal" size={22} color={color} />
            ),
=======
            title: t('nav.settings'),
            tabBarAccessibilityLabel: `${t('nav.settings')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="settings-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: t('nav.activity'),
            tabBarAccessibilityLabel: `${t('nav.activity')} tab`,
            tabBarIcon: ({ color }) => <TabBarIcon name="time-outline" color={color} />,
>>>>>>> 52573a5 (feat(mobile): accessibility lite pass for Expo app)
          }}
        />
      </Tabs>
    </RoleGuardGate>
  );
}
