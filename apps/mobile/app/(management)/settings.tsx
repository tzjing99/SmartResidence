import { Ionicons } from '@expo/vector-icons';
import { AlignRow, AppText, Card, palette } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

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
      <AppText variant="title">Settings</AppText>
      <AppText variant="meta">Condo configuration and management preferences.</AppText>

      {SECTIONS.map((section) => (
        <Pressable
          key={section.title}
          disabled={!section.href}
          onPress={() => section.href && router.push(section.href as Href)}
        >
          <Card>
            <AlignRow minHeight={44}>
              <Ionicons name={section.icon} size={22} color={palette.coralPrimary} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="label">{section.title}</AppText>
                <AppText variant="meta">{section.description}</AppText>
              </View>
              {section.href ? (
                <Ionicons name="chevron-forward" size={18} color={palette.mutedLight} />
              ) : (
                <AppText variant="caption">Soon</AppText>
              )}
            </AlignRow>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
