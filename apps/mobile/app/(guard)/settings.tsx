import { Card, palette } from '@smartresidence/ui-mobile';
import { ScrollView, Text } from 'react-native';

export default function GuardSettingsScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Settings</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
        Guard preferences for check-in workflows.
      </Text>
      <Card>
        <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
          No guard-specific settings are available yet. Scanning and visitor verification options are
          configured automatically for your condo.
        </Text>
      </Card>
    </ScrollView>
  );
}
