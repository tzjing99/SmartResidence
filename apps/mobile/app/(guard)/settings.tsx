import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@smartresidence/api-client';
import { AppText, Button, Card, Pill, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { Alert, StyleSheet, View } from 'react-native';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_SOFT_SKY,
  GuardScreen,
  GuardSectionHeader,
  guardStyles,
} from '../../src/components/guard-screen';
import { api } from '../../src/lib/api';
import type { MeResponse } from '../../src/lib/roles';
import { useSignOut } from '../../src/lib/use-sign-out';

const mapRoleLabel = (role: string | null | undefined): string => {
  if (!role) return 'Resident';
  if (role === 'SECURITY_GUARD') return 'Guard';
  if (role === 'UNIT_OWNER' || role === 'OWNER') return 'Owner';
  if (role === 'TENANT') return 'Tenant';
  if (role === 'SUPER_ADMIN' || role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF')
    return 'Management';
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
    <GuardScreen
      eyebrow="Guard settings"
      title="Account and shift"
      subtitle="Confirm the signed-in guard account and sign out when handing the device to another team member."
    >
      <Card style={[guardStyles.card, styles.accountCard]}>
        <View style={styles.avatar}>
          <AppText style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </AppText>
        </View>
        <View style={styles.accountCopy}>
          <AppText numberOfLines={2} style={styles.accountName}>
            {user?.name ?? 'Loading...'}
          </AppText>
          {user?.email ? (
            <AppText numberOfLines={2} variant="meta" style={styles.cardMeta}>
              {user.email}
            </AppText>
          ) : null}
          <View style={styles.pillRow}>
            <Pill tone="primary" label={mapRoleLabel(user?.activeRole)} />
            <Pill tone="success" label="Signed in" />
          </View>
        </View>
      </Card>

      <GuardSectionHeader
        title="Guard app setup"
        subtitle="Scanning and visitor verification are configured automatically for this condo."
      />
      <Card style={[guardStyles.card, styles.infoCard]}>
        <View style={styles.infoIcon}>
          <Ionicons name="qr-code-outline" size={20} color={GUARD_CORAL} />
        </View>
        <View style={styles.accountCopy}>
          <AppText style={styles.infoTitle}>Ready for gate operations</AppText>
          <AppText variant="meta" style={styles.cardMeta}>
            Use Scan for QR passes, Manual when a code cannot scan, and Walk-in for visitors already
            at the guardhouse.
          </AppText>
        </View>
      </Card>

      <Card style={[guardStyles.card, styles.signOutCard]}>
        <View style={styles.signOutHeader}>
          <View style={styles.infoIconSky}>
            <Ionicons name="log-out-outline" size={20} color={palette.messageMgmtSkyText} />
          </View>
          <View style={styles.accountCopy}>
            <AppText style={styles.infoTitle}>End this guard session</AppText>
            <AppText variant="meta" style={styles.cardMeta}>
              Sign out before sharing this device or leaving the guard post.
            </AppText>
          </View>
        </View>
        <Button title="Sign out" variant="secondary" loading={busy} onPress={confirmSignOut} />
      </Card>
    </GuardScreen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GUARD_CORAL,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  accountName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: palette.textLight,
  },
  cardMeta: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconSky: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_SKY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    color: palette.textLight,
    fontWeight: '800',
  },
  signOutCard: {
    gap: spacing.md,
  },
  signOutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
