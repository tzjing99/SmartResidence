import { Ionicons } from '@expo/vector-icons';
import { useMe, usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import {
  AlignRow,
  AppText,
  Button,
  Card,
  Field,
  Input,
  type ThemePreference,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
  useResidentColors,
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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

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
  const colors = useResidentColors();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.coralSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={colors.coral} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontWeight: '700', color: colors.fg }} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" style={{ color: colors.muted }} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
  const { preference, setPreference, colors } = useTheme();
  const residentColors = useResidentColors();

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

  const revertFromServer = useCallback(() => {
    if (!prefs.data) return;
    setEmailNotifications(prefs.data.emailNotifications);
    setWhatsappNotifications(prefs.data.whatsappNotifications);
    setQuietEnabled(prefs.data.quietHours.enabled);
    setQuietStart(prefs.data.quietHours.start);
    setQuietEnd(prefs.data.quietHours.end);
  }, [prefs.data]);

  const applyPreferences = useCallback(
    (update: {
      emailNotifications?: boolean;
      whatsappNotifications?: boolean;
      quietEnabled?: boolean;
      quietStart?: string;
      quietEnd?: string;
    }) => {
      const nextEmail = update.emailNotifications ?? emailNotifications;
      const nextWhatsapp = update.whatsappNotifications ?? whatsappNotifications;
      const nextQuietEnabled = update.quietEnabled ?? quietEnabled;
      const nextQuietStart = update.quietStart ?? quietStart;
      const nextQuietEnd = update.quietEnd ?? quietEnd;

      if (update.emailNotifications !== undefined) setEmailNotifications(nextEmail);
      if (update.whatsappNotifications !== undefined) setWhatsappNotifications(nextWhatsapp);
      if (update.quietEnabled !== undefined) setQuietEnabled(nextQuietEnabled);
      if (update.quietStart !== undefined) setQuietStart(nextQuietStart);
      if (update.quietEnd !== undefined) setQuietEnd(nextQuietEnd);

      void save
        .mutateAsync({
          emailNotifications: nextEmail,
          whatsappNotifications: nextWhatsapp,
          quietHours: {
            enabled: nextQuietEnabled,
            start: nextQuietStart,
            end: nextQuietEnd,
          },
        })
        .catch((err: Error) => {
          revertFromServer();
          Alert.alert('Error', err.message);
        });
    },
    [
      emailNotifications,
      whatsappNotifications,
      quietEnabled,
      quietStart,
      quietEnd,
      revertFromServer,
      save,
    ],
  );

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
            backgroundColor: residentColors.coral,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AppText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.fg }} numberOfLines={2}>
            {user?.name ?? 'Loading...'}
          </AppText>
          {user?.email ? (
            <AppText style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
              {user.email}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            <View
              style={{
                backgroundColor: colors.messageMgmtCoralBg,
                borderColor: colors.messageMgmtCoralBorder,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <AppText style={{ fontSize: 11, fontWeight: '600', color: colors.coral }}>
                {mapRoleLabel(user?.activeRole)}
              </AppText>
            </View>
          </View>
        </View>
      </Card>

      <ResidentSectionHeader
        title="Appearance"
        subtitle="Match your device or choose light or dark mode."
      />

      <Card style={residentStyles.card}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {THEME_OPTIONS.map((option) => {
            const active = preference === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? colors.coral : colors.border,
                  backgroundColor: active ? colors.messageMgmtCoralBg : colors.messageResidentBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  style={{
                    fontWeight: '700',
                    color: active ? colors.coral : colors.fg,
                    fontSize: 13,
                  }}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
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
          <Switch
            value={emailNotifications}
            disabled={save.isPending}
            onValueChange={(value) => applyPreferences({ emailNotifications: value })}
          />
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
            disabled={!prefs.data?.whatsappEligible || save.isPending}
            onValueChange={(value) => applyPreferences({ whatsappNotifications: value })}
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
          <Switch
            value={quietEnabled}
            disabled={save.isPending}
            onValueChange={(value) => applyPreferences({ quietEnabled: value })}
          />
        </AlignRow>
        {quietEnabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <Field label="From" containerStyle={{ flex: 1, minWidth: 120 }}>
              <Input
                value={quietStart}
                onChangeText={setQuietStart}
                onEndEditing={() => applyPreferences({ quietStart })}
                placeholder="22:00"
                editable={!save.isPending}
              />
            </Field>
            <Field label="Until" containerStyle={{ flex: 1, minWidth: 120 }}>
              <Input
                value={quietEnd}
                onChangeText={setQuietEnd}
                onEndEditing={() => applyPreferences({ quietEnd })}
                placeholder="07:00"
                editable={!save.isPending}
              />
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
          icon="warning-outline"
          title="Emergency SOS"
          subtitle="Alert guards in a real emergency"
          onPress={() => router.push('/(resident)/sos' as Href)}
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
