import { Button, Card, palette } from '@smartresidence/ui-mobile';
import { Alert, ScrollView, Text } from 'react-native';
import { useSignOut } from '../../src/lib/use-sign-out';

export default function GuardSettingsScreen() {
  const { signOut, busy } = useSignOut();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to use the guard app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Settings</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
        Guard preferences for check-in workflows.
      </Text>
      <Card>
        <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
          No guard-specific settings are available yet. Scanning and visitor verification options
          are configured automatically for your condo.
        </Text>
      </Card>
      <Button title="Sign out" variant="secondary" loading={busy} onPress={confirmSignOut} />
    </ScrollView>
  );
}
