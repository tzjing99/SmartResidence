import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@smartresidence/ui-mobile';

export default function GuardLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.coralPrimary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { paddingTop: 6, height: 60 },
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expected"
        options={{
          title: 'Expected',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          title: 'Manual',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
