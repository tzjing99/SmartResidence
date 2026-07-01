import { Ionicons } from '@expo/vector-icons';
import { useMe, usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import {
  AlignRow,
  AppText,
  Button,
  Card,
  Field,
  Input,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import {
  RESIDENT_CORAL,
  RESIDENT_SOFT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function MoreLink({
  icon,
  title,
  subtitle,
  onPress,
  isLast,
}: {
  icon: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.borderLight,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: RESIDENT_SOFT_CORAL,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={RESIDENT_CORAL} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight }} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.mutedLight} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);
  const { signOut, busy: signingOut } = useSignOut();

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  useEffect(() => {
    if (!prefs.data) return;
    setEmailNotifications(prefs.data.emailNotifications);
    setWhatsappNotifications(prefs.data.whatsappNotifications);
    setQuietEnabled(prefs.data.quietHours.enabled);
    setQuietStart(prefs.data.quietHours.start);
    setQuietEnd(prefs.data.quietHours.end);
  }, [prefs.data]);

  async function onSave() {
    try {
      await save.mutateAsync({
        emailNotifications,
        whatsappNotifications,
        quietHours: { enabled: quietEnabled, start: quietStart, end: quietEnd },
      });
      Alert.alert('Saved', 'Notification preferences updated');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }

  return (
    <ResidentScreen
      eyebrow="Settings"
      title="Account and home"
      subtitle="Keep your profile, notifications, and sign-in access in one place."
    >
      <Card
        style={[
          residentStyles.card,
          {
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          },
        ]}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: RESIDENT_CORAL,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AppText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText
            style={{ fontSize: 16, fontWeight: '700', color: palette.textLight }}
            numberOfLines={2}
          >
            {user?.name ?? 'Loading...'}
          </AppText>
          {user?.email ? (
            <AppText style={{ fontSize: 13, color: palette.mutedLight }} numberOfLines={1}>
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

      <ResidentSectionHeader
        title="Notifications"
        subtitle="In-app and push stay on by default. Configure email, WhatsApp, and quiet hours below."
      />

      <Card style={residentStyles.card}>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">Email for threads</AppText>
            <AppText variant="meta">Opt in to email notifications for helpdesk updates</AppText>
          </View>
          <Switch value={emailNotifications} onValueChange={setEmailNotifications} />
        </AlignRow>
      </Card>

      <Card style={residentStyles.card}>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">WhatsApp alerts</AppText>
            <AppText variant="meta">
              Parcel, visitor, and billing reminders on your verified phone
            </AppText>
            {!prefs.data?.whatsappEligible ? (
              <AppText variant="meta" style={{ marginTop: 4 }}>
                Add and verify your mobile number in Profile first.
              </AppText>
            ) : null}
          </View>
          <Switch
            value={whatsappNotifications}
            onValueChange={setWhatsappNotifications}
            disabled={!prefs.data?.whatsappEligible}
          />
        </AlignRow>
      </Card>

      <Card style={residentStyles.card}>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">Quiet hours</AppText>
            <AppText variant="meta">
              Suppress push during these hours (in-app still delivered)
            </AppText>
          </View>
          <Switch value={quietEnabled} onValueChange={setQuietEnabled} />
        </AlignRow>
        {quietEnabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <Field label="From" containerStyle={{ flex: 1, minWidth: 120 }}>
              <Input value={quietStart} onChangeText={setQuietStart} placeholder="22:00" />
            </Field>
            <Field label="Until" containerStyle={{ flex: 1, minWidth: 120 }}>
              <Input value={quietEnd} onChangeText={setQuietEnd} placeholder="07:00" />
            </Field>
          </View>
        ) : null}
      </Card>

      <ResidentSectionHeader
        title="More"
        subtitle="Everything else your resident account can do."
      />

      <Card style={[residentStyles.card, { paddingVertical: 4 }]}>
        <MoreLink
          icon="notifications-outline"
          title="Notifications"
          subtitle="Alerts, approvals, and updates"
          onPress={() => router.push('/(resident)/notifications' as Href)}
        />
        <MoreLink
          icon="podium-outline"
          title="MC polls"
          subtitle="Vote in owner consultations"
          onPress={() => router.push('/(resident)/polls' as Href)}
        />
        <MoreLink
          icon="calendar-outline"
          title="Facilities"
          subtitle="Book shared amenities"
          onPress={() => router.push('/(resident)/facilities' as Href)}
        />
        <MoreLink
          icon="document-text-outline"
          title="Documents"
          subtitle="House rules, minutes, and circulars"
          onPress={() => router.push('/(resident)/documents' as Href)}
        />
        <MoreLink
          icon="repeat-outline"
          title="Recurring visitor passes"
          subtitle="Repeat access for regular guests"
          onPress={() => router.push('/(resident)/visitors/recurring' as Href)}
        />
        <MoreLink
          icon="help-circle-outline"
          title="Help & FAQ"
          subtitle="Answers from your management office"
          onPress={() => router.push('/(resident)/faq' as Href)}
        />
        <MoreLink
          icon="key-outline"
          title="Who has access to my unit"
          subtitle="Review and revoke delegated access"
          onPress={() => router.push('/(resident)/access' as Href)}
          isLast
        />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button title={save.isPending ? 'Saving…' : 'Save preferences'} onPress={onSave} />
        <Button
          title="Sign out"
          variant="secondary"
          loading={signingOut}
          onPress={() => {
            Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        />
      </View>
    </ResidentScreen>
  );
}
