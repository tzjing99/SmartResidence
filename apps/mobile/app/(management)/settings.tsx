import { Ionicons } from '@expo/vector-icons';
import { Card, palette } from '@smartresidence/ui-mobile';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

const SECTIONS = [
  {
    title: 'Helpdesk & SLA',
    description: 'Response windows, grace period, and priority targets',
    href: '/(management)/helpdesk-settings' as const,
    icon: 'time-outline' as const,
  },
  {
    title: 'Notifications',
    description: 'Staff alert preferences (coming soon)',
    href: null,
    icon: 'notifications-outline' as const,
  },
];

export default function ManagementSettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Settings</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
        Condo configuration and management preferences.
      </Text>

      {SECTIONS.map((section) => (
        <Pressable
          key={section.title}
          disabled={!section.href}
          onPress={() => section.href && router.push(section.href)}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name={section.icon} size={22} color={palette.coralPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{section.title}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 4 }}>
                  {section.description}
                </Text>
              </View>
              {section.href ? (
                <Ionicons name="chevron-forward" size={18} color={palette.mutedLight} />
              ) : (
                <Text style={{ color: palette.mutedLight, fontSize: 11 }}>Soon</Text>
              )}
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
