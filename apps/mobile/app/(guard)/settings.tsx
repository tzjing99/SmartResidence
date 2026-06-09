import { useMe } from '@smartresidence/api-client';
import { AppText, Button, Card, palette } from '@smartresidence/ui-mobile';
import { Alert, ScrollView, View } from 'react-native';
import { api } from '../../src/lib/api';
import { useSignOut } from '../../src/lib/use-sign-out';
import type { MeResponse } from '../../src/lib/roles';

const mapRoleLabel = (role: string | null | undefined): string => {
  if (!role) return 'Resident';
  if (role === 'SECURITY_GUARD') return 'Guard';
  if (role === 'UNIT_OWNER' || role === 'OWNER') return 'Owner';
  if (role === 'TENANT') return 'Tenant';
  if (role === 'SUPER_ADMIN' || role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF') return 'Management';
  return 'Resident';
};

export default function GuardSettingsScreen() {
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
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
      <AppText variant="title">Settings</AppText>

      <Card style={{ padding: 16, marginTop: 4, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: palette.coralPrimary,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AppText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontSize: 16, fontWeight: '700', color: palette.textLight }}>
            {user?.name ?? 'Loading...'}
          </AppText>
          {user?.email ? (
            <AppText style={{ fontSize: 13, color: palette.mutedLight }}>
              {user.email}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            <View
              style={{
                backgroundColor: palette.messageMgmtCoralBg,
                borderColor: palette.messageMgmtCoralBorder,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <AppText
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: palette.coralPrimary,
                }}
              >
                {mapRoleLabel(user?.activeRole)}
              </AppText>
            </View>
          </View>
        </View>
      </Card>

      <AppText variant="subheading">Guard Preferences</AppText>
      <AppText variant="meta">
        Guard preferences for check-in workflows.
      </AppText>
      <Card>
        <AppText variant="bodySm" style={{ color: palette.mutedLight }}>
          No guard-specific settings are available yet. Scanning and visitor verification options
          are configured automatically for your condo.
        </AppText>
      </Card>
      <Button title="Sign out" variant="secondary" loading={busy} onPress={confirmSignOut} />
    </ScrollView>
  );
}
