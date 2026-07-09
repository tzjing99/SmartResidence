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
import * as FileSystem from 'expo-file-system/legacy';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Switch, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
  useResidentColors,
} from '../../src/components/resident-screen';
import type { LocalePreference } from '../../src/i18n/detect-locale';
import { useLocale, useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';
import type { MeResponse } from '../../src/lib/roles';
import { useSignOut } from '../../src/lib/use-sign-out';

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
        <AppText style={{ fontWeight: '700', color: colors.fg }} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="meta" style={{ color: colors.muted }} numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useT();
  const { preference: localePreference, setPreference: setLocalePreference } = useLocale();
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);
  const { signOut, busy: signingOut } = useSignOut();
  const { preference, setPreference, colors } = useTheme();
  const residentColors = useResidentColors();

  const mapRoleLabel = (role: string | null | undefined): string => {
    if (!role) return t('account.roleResident');
    if (role === 'SECURITY_GUARD') return t('account.roleGuard');
    if (role === 'UNIT_OWNER' || role === 'OWNER') return t('account.roleOwner');
    if (role === 'TENANT') return t('account.roleTenant');
    if (role === 'SUPER_ADMIN' || role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF')
      return t('account.roleManagement');
    return t('account.roleResident');
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('account.themeSystem') },
    { value: 'light', label: t('account.themeLight') },
    { value: 'dark', label: t('account.themeDark') },
  ];

  const localeOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('account.localeSystem') },
    { value: 'en', label: t('account.localeEn') },
    { value: 'ms', label: t('account.localeMs') },
    { value: 'zh-Hans', label: t('account.localeZhHans') },
  ];

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [exportPending, setExportPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  async function onDownloadMyData() {
    setExportPending(true);
    try {
      const meta = await api.requestDataExport();
      const { uri, headers } = await api.dataExportDownloadSource(meta.exportId);
      const path = `${FileSystem.cacheDirectory}data-export-${meta.exportId.slice(0, 8)}.json`;
      const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
      await Linking.openURL(downloaded.uri);
      Alert.alert(t('account.downloadStartedTitle'), t('account.downloadStartedBody'));
    } catch (err) {
      Alert.alert(t('account.exportErrorTitle'), (err as Error).message);
    } finally {
      setExportPending(false);
    }
  }

  function onRequestDeleteAccount() {
    Alert.alert(
      'Delete my account',
      'This anonymizes your personal data, signs you out everywhere, and ends unit access. Billing and condo history stay for legal records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteConfirmOpen(true);
          },
        },
      ],
    );
  }

  async function onConfirmDeleteAccount() {
    if (deleteConfirmText.trim() !== 'DELETE MY ACCOUNT') {
      Alert.alert('Could not delete account', 'Type DELETE MY ACCOUNT exactly to confirm.');
      return;
    }
    setDeletePending(true);
    try {
      await api.deleteAccount('DELETE MY ACCOUNT');
      setDeleteConfirmOpen(false);
      await signOut();
    } catch (err) {
      Alert.alert('Could not delete account', (err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

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
          Alert.alert(t('account.errorTitle'), err.message);
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
      t,
    ],
  );

  return (
    <ResidentScreen
      eyebrow={t('account.settingsEyebrow')}
      title={t('account.settingsTitle')}
      subtitle={t('account.settingsSubtitle')}
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
            {user?.name ?? t('account.loading')}
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
        title={t('account.appearanceTitle')}
        subtitle={t('account.appearanceDesc')}
      />

      <Card style={residentStyles.card}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {themeOptions.map((option) => {
            const active = preference === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={{
                  flexGrow: 1,
                  flexBasis: 96,
                  minHeight: 44,
                  paddingHorizontal: 8,
                  paddingVertical: 10,
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
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={residentStyles.card}>
        <AppText variant="label">Text size</AppText>
        <AppText variant="meta" style={{ marginTop: 4 }}>
          Text size follows your phone Settings → Display (or Accessibility → Display & Text Size on
          iOS).
        </AppText>
      </Card>

      <ResidentSectionHeader
        title={t('account.languageTitle')}
        subtitle={t('account.languageDesc')}
      />

      <Card style={residentStyles.card}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {localeOptions.map((option) => {
            const active = localePreference === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setLocalePreference(option.value)}
                style={{
                  flexGrow: 1,
                  flexBasis: '45%',
                  minHeight: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? colors.coral : colors.border,
                  backgroundColor: active ? colors.messageMgmtCoralBg : colors.messageResidentBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <AppText
                  style={{
                    fontWeight: '700',
                    color: active ? colors.coral : colors.fg,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <ResidentSectionHeader
        title={t('account.notificationsTitle')}
        subtitle={t('account.notificationsDesc')}
      />

      <Card style={residentStyles.card}>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">{t('account.emailThreads')}</AppText>
            <AppText variant="meta">{t('account.emailThreadsDesc')}</AppText>
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
            <AppText variant="label">{t('account.whatsappAlerts')}</AppText>
            <AppText variant="meta">{t('account.whatsappAlertsDesc')}</AppText>
            {!prefs.data?.whatsappEligible ? (
              <AppText variant="meta" style={{ marginTop: 4 }}>
                {t('account.whatsappNeedPhone')}
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
            <AppText variant="label">{t('account.quietHours')}</AppText>
            <AppText variant="meta">{t('account.quietHoursDesc')}</AppText>
          </View>
          <Switch
            value={quietEnabled}
            disabled={save.isPending}
            onValueChange={(value) => applyPreferences({ quietEnabled: value })}
          />
        </AlignRow>
        {quietEnabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <Field label={t('account.quietFrom')} containerStyle={{ flex: 1, minWidth: 120 }}>
              <Input
                value={quietStart}
                onChangeText={setQuietStart}
                onEndEditing={() => applyPreferences({ quietStart })}
                placeholder="22:00"
                editable={!save.isPending}
              />
            </Field>
            <Field label={t('account.quietUntil')} containerStyle={{ flex: 1, minWidth: 120 }}>
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
        title={t('account.privacyTitle')}
        subtitle={t('account.privacyDesc')}
      />

      <Card style={residentStyles.card}>
        <Button
          title={exportPending ? t('account.downloadMyDataPending') : t('account.downloadMyData')}
          onPress={() => void onDownloadMyData()}
          disabled={exportPending || deletePending}
        />
        <View style={{ height: spacing.md }} />
        <AppText muted style={{ marginBottom: spacing.sm }}>
          Deleting anonymizes your personal data and signs you out everywhere. Billing history is
          kept for legal records.
        </AppText>
        {!deleteConfirmOpen ? (
          <Button
            title="Delete my account"
            variant="destructive"
            onPress={onRequestDeleteAccount}
            disabled={exportPending || deletePending}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Field label="Type DELETE MY ACCOUNT to confirm">
              <Input
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
                editable={!deletePending}
                placeholder="DELETE MY ACCOUNT"
              />
            </Field>
            <AlignRow gap={spacing.sm}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText('');
                }}
                disabled={deletePending}
              />
              <Button
                title={deletePending ? 'Deleting…' : 'Confirm delete'}
                variant="destructive"
                onPress={() => void onConfirmDeleteAccount()}
                disabled={deletePending}
              />
            </AlignRow>
          </View>
        )}
      </Card>

      <ResidentSectionHeader title={t('account.moreTitle')} subtitle={t('account.moreSubtitle')} />

      <Card style={[residentStyles.card, { paddingVertical: 4 }]}>
        <MoreLink
          icon="notifications-outline"
          title={t('nav.screens.notifications')}
          subtitle={t('account.notificationsDesc')}
          onPress={() => router.push('/(resident)/notifications' as Href)}
        />
        <MoreLink
          icon="podium-outline"
          title={t('nav.screens.polls')}
          subtitle={t('nav.sections.community')}
          onPress={() => router.push('/(resident)/polls' as Href)}
        />
        <MoreLink
          icon="calendar-outline"
          title={t('nav.screens.facilities')}
          subtitle={t('nav.sections.amenities')}
          onPress={() => router.push('/(resident)/facilities' as Href)}
        />
        <MoreLink
          icon="document-text-outline"
          title={t('nav.screens.documents')}
          subtitle={t('nav.sections.notices')}
          onPress={() => router.push('/(resident)/documents' as Href)}
        />
        <MoreLink
          icon="repeat-outline"
          title={t('nav.screens.recurringPasses')}
          subtitle={t('nav.screens.visitors')}
          onPress={() => router.push('/(resident)/visitors/recurring' as Href)}
        />
        <MoreLink
          icon="help-circle-outline"
          title={t('nav.screens.faq')}
          subtitle={t('faq.subtitle')}
          onPress={() => router.push('/(resident)/faq' as Href)}
        />
        <MoreLink
          icon="warning-outline"
          title={t('mobile.home.emergencySos')}
          subtitle={t('mobile.home.quickActions')}
          onPress={() => router.push('/(resident)/sos' as Href)}
        />
        <MoreLink
          icon="key-outline"
          title={t('nav.screens.access')}
          subtitle={t('nav.manageAccess')}
          onPress={() => router.push('/(resident)/access' as Href)}
          isLast
        />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button
          title={t('account.signOut')}
          variant="secondary"
          loading={signingOut}
          onPress={() => {
            Alert.alert(t('account.signOutConfirmTitle'), t('account.signOutConfirmBody'), [
              { text: t('account.cancel'), style: 'cancel' },
              {
                text: t('account.signOut'),
                style: 'destructive',
                onPress: () => void signOut(),
              },
            ]);
          }}
        />
      </View>
    </ResidentScreen>
  );
}
