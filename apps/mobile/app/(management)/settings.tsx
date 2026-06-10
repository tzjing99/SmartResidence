import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@smartresidence/api-client';
import { AlignRow, AppText, Button, Card, palette } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
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

const ENABLED_MODULES = [
  {
    title: 'Helpdesk Tickets',
    description: 'View, claim, triage, and reply to resident helpdesk tickets',
    href: '/(management)/helpdesk' as const,
    icon: 'chatbubbles-outline' as const,
  },
  {
    title: 'Helpdesk SLA',
    description: 'Response windows, grace period, and priority targets',
    href: '/(management)/helpdesk-settings' as const,
    icon: 'time-outline' as const,
  },
];

const WEB_ONLY_MODULES = [
  {
    title: 'Announcements',
    description: 'Broadcast community notifications & push messages',
    icon: 'megaphone-outline' as const,
  },
  {
    title: 'Billing & Finance',
    description: 'Issue invoices, track payments, and audit accounts',
    icon: 'card-outline' as const,
  },
  {
    title: 'Unit Management',
    description: 'Manage residents, occupancy, and registration approvals',
    icon: 'home-outline' as const,
  },
  {
    title: 'User & Role Controls',
    description: 'Grant and revoke management or guard permissions',
    icon: 'people-outline' as const,
  },
];

export default function ManagementSettingsScreen() {
  const router = useRouter();
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const { signOut, busy } = useSignOut();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
    >
      <AppText variant="title">Settings</AppText>

      {/* Account Card */}
      <Card
        style={{
          padding: 16,
          marginTop: 4,
          marginBottom: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
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
            <AppText style={{ fontSize: 13, color: palette.mutedLight }}>{user.email}</AppText>
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

      {/* Airbnb-grade Info Card for Limited Mobile Admin */}
      <Card
        style={{
          backgroundColor: palette.messageMgmtSkyBg,
          borderColor: palette.messageMgmtSkyBorder,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          gap: 10,
          marginBottom: 4,
        }}
      >
        <AlignRow gap={8} style={{ minHeight: 0 }}>
          <Ionicons name="information-circle" size={22} color={palette.messageMgmtSkyText} />
          <AppText
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: palette.messageMgmtSkyText,
            }}
          >
            Mobile Administration is Limited
          </AppText>
        </AlignRow>
        <AppText
          style={{
            fontSize: 12,
            lineHeight: 16,
            color: palette.textLight,
          }}
        >
          To keep tools simple and fast on the move, mobile access is restricted. Full management
          tools like billing, unit configuration, and announcements are available via our web
          portal.
        </AppText>
        <Button
          title="Open Web Admin"
          variant="soft-sky"
          size="sm"
          onPress={async () => {
            const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000';
            try {
              await Linking.openURL(webUrl);
            } catch (err) {
              Alert.alert('Cannot open URL', `Failed to open web admin at: ${webUrl}`);
            }
          }}
        />
      </Card>

      <AppText
        variant="meta"
        style={{ marginTop: 8, fontWeight: '700', color: palette.mutedLight, fontSize: 11 }}
      >
        ON-THE-GO MODULES
      </AppText>

      {ENABLED_MODULES.map((module) => (
        <Pressable key={module.title} onPress={() => router.push(module.href as Href)}>
          <Card>
            <AlignRow minHeight={44}>
              <Ionicons name={module.icon} size={22} color={palette.coralPrimary} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="label">{module.title}</AppText>
                <AppText variant="meta">{module.description}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.mutedLight} />
            </AlignRow>
          </Card>
        </Pressable>
      ))}

      <AppText
        variant="meta"
        style={{ marginTop: 12, fontWeight: '700', color: palette.mutedLight, fontSize: 11 }}
      >
        WEB-ONLY MODULES (DESKTOP)
      </AppText>

      {WEB_ONLY_MODULES.map((module) => (
        <Card key={module.title} style={{ opacity: 0.6, backgroundColor: '#F3F4F6' }}>
          <AlignRow minHeight={44}>
            <Ionicons name={module.icon} size={22} color={palette.mutedLight} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label" style={{ color: palette.mutedLight }}>
                {module.title}
              </AppText>
              <AppText variant="meta" style={{ color: palette.mutedLight }}>
                {module.description}
              </AppText>
            </View>
            <View
              style={{
                backgroundColor: '#E5E7EB',
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <AppText style={{ fontSize: 9, fontWeight: '600', color: palette.mutedLight }}>
                Web only
              </AppText>
            </View>
          </AlignRow>
        </Card>
      ))}

      <View style={{ marginTop: 16 }}>
        <Button
          title="Sign out"
          variant="secondary"
          loading={busy}
          onPress={() => {
            Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        />
      </View>
    </ScrollView>
  );
}
