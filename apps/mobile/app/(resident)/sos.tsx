import { Ionicons } from '@expo/vector-icons';
import {
  useCancelSos,
  useMe,
  useMyCondos,
  useMySosAlerts,
  useMyUnits,
  useRaiseSos,
} from '@smartresidence/api-client';
import {
  SOS_KIND_LABELS,
  SOS_STATUS_LABELS,
  type SosAlert,
  type SosKind,
  isSosOpen,
} from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';

const EMERGENCY_RED = '#DC2626';
const SOFT_RED = '#FEE2E2';
const WARM_BG = '#FFF8F6';
const CARD_BORDER = '#F1E8E4';

const SOS_KINDS: SosKind[] = ['GENERAL', 'MEDICAL', 'SECURITY', 'FIRE'];

const KIND_ICONS: Record<SosKind, keyof typeof Ionicons.glyphMap> = {
  GENERAL: 'alert-circle-outline',
  MEDICAL: 'medkit-outline',
  SECURITY: 'shield-outline',
  FIRE: 'flame-outline',
};

function statusTone(status: SosAlert['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'danger' as const;
    case 'ACKNOWLEDGED':
      return 'warning' as const;
    case 'RESOLVED':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}

function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe(api);
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const condo = condos.data?.[0];
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;

  const raise = useRaiseSos(api);
  const cancel = useCancelSos(api);
  const alerts = useMySosAlerts(api);

  const [kind, setKind] = useState<SosKind>('GENERAL');
  const [locationNote, setLocationNote] = useState('');

  const latest = alerts.data?.items?.[0];
  const openAlert = alerts.data?.items?.find((a) => isSosOpen(a.status));

  async function sendSos() {
    if (!condo?.id) {
      Alert.alert('Not ready', 'We could not find your condo. Please try again in a moment.');
      return;
    }
    try {
      await raise.mutateAsync({
        condoId: condo.id,
        unitId: unit?.id,
        kind,
        locationNote: locationNote.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocationNote('');
      Alert.alert(
        'Help is being alerted',
        'Guards and management have been notified. Stay safe and keep your phone nearby.',
      );
      void alerts.refetch();
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not send SOS', (err as Error).message);
    }
  }

  function confirmSend() {
    if (raise.isPending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Send emergency SOS?',
      `This raises a ${SOS_KIND_LABELS[kind].toLowerCase()} alert to guards and management at ${
        condo?.name ?? 'your condo'
      }. Only use this for genuine emergencies.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS', style: 'destructive', onPress: () => void sendSos() },
      ],
    );
  }

  function confirmCancel(id: string) {
    Alert.alert('Cancel this SOS?', 'Let guards know this was a false alarm or is resolved.', [
      { text: 'Keep active', style: 'cancel' },
      {
        text: 'Cancel SOS',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(id, {
            onSuccess: () => void alerts.refetch(),
            onError: (err) => Alert.alert('Could not cancel', (err as Error).message),
          }),
      },
    ]);
  }

  const loadingContext = condos.isLoading || me.isLoading;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 24, 36),
          paddingBottom: Math.max(insets.bottom, 16) + 84,
        },
      ]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} contentStyle={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={palette.textLight} />
          <AppText style={styles.backText}>Home</AppText>
        </AnimatedPressable>
        <AppText variant="caption" style={styles.eyebrow}>
          Emergency SOS
        </AppText>
        <AppText numberOfLines={2} style={styles.title}>
          Raise an emergency alert
        </AppText>
        <AppText style={styles.subtitle}>
          For genuine emergencies at {condo?.name ?? 'your condo'}. Guards and management are
          notified immediately. For life-threatening cases also call 999.
        </AppText>
      </View>

      <Card style={styles.panicCard}>
        <AppText style={styles.sectionLabel}>What is the emergency?</AppText>
        <View style={styles.kindGrid}>
          {SOS_KINDS.map((k) => {
            const active = k === kind;
            return (
              <AnimatedPressable
                key={k}
                onPress={() => setKind(k)}
                style={styles.kindTileWrap}
                contentStyle={[styles.kindTile, active ? styles.kindTileActive : null]}
              >
                <Ionicons
                  name={KIND_ICONS[k]}
                  size={22}
                  color={active ? EMERGENCY_RED : palette.mutedLight}
                />
                <AppText style={[styles.kindLabel, active ? styles.kindLabelActive : null]}>
                  {SOS_KIND_LABELS[k]}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        <AppText style={[styles.sectionLabel, { marginTop: spacing.md }]}>
          Where are you? (optional)
        </AppText>
        <TextInput
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="e.g. Block A lift lobby, level 3 car park"
          placeholderTextColor={palette.mutedLight}
          style={styles.noteInput}
          multiline
          maxLength={500}
        />

        <AnimatedPressable
          onPress={confirmSend}
          disabled={raise.isPending || loadingContext}
          contentStyle={[
            styles.panicButton,
            raise.isPending || loadingContext ? styles.panicButtonDisabled : null,
          ]}
        >
          {raise.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="warning" size={22} color="#FFFFFF" />
              <AppText style={styles.panicButtonText}>Send SOS</AppText>
            </>
          )}
        </AnimatedPressable>
        <AppText style={styles.panicHint}>
          You will be asked to confirm before the alert is sent.
        </AppText>
      </Card>

      <View style={styles.sectionHeader}>
        <AppText variant="subheading">Your alerts</AppText>
        <AppText variant="meta" style={styles.sectionCopy}>
          Track the status of alerts you have raised.
        </AppText>
      </View>

      {alerts.isLoading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator color={EMERGENCY_RED} />
          <AppText variant="meta" style={styles.stateCopy}>
            Loading your alerts…
          </AppText>
        </Card>
      ) : alerts.isError ? (
        <Card style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={22} color={palette.mutedLight} />
          <AppText style={styles.stateTitle}>Could not load alerts</AppText>
          <AppText variant="meta" style={styles.stateCopy}>
            Check your connection and try again.
          </AppText>
          <Button title="Retry" variant="secondary" onPress={() => void alerts.refetch()} />
        </Card>
      ) : !latest ? (
        <Card style={styles.stateCard}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#047857" />
          <AppText style={styles.stateTitle}>No alerts raised</AppText>
          <AppText variant="meta" style={styles.stateCopy}>
            You have not raised any emergency alerts. Use the button above only in a real emergency.
          </AppText>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {(alerts.data?.items ?? []).slice(0, 5).map((alert) => {
            const open = isSosOpen(alert.status);
            return (
              <Card key={alert.id} style={styles.alertCard}>
                <View style={styles.alertTopRow}>
                  <View style={styles.alertIcon}>
                    <Ionicons name={KIND_ICONS[alert.kind]} size={20} color={EMERGENCY_RED} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText style={styles.alertKind}>{SOS_KIND_LABELS[alert.kind]}</AppText>
                    <AppText variant="meta" style={styles.alertMeta}>
                      Raised {formatWhen(alert.createdAt)}
                    </AppText>
                  </View>
                  <Pill tone={statusTone(alert.status)} label={SOS_STATUS_LABELS[alert.status]} />
                </View>

                {alert.locationNote ? (
                  <AppText variant="meta" style={styles.alertLocation}>
                    Location: {alert.locationNote}
                  </AppText>
                ) : null}

                {alert.acknowledgedBy ? (
                  <AppText variant="meta" style={styles.alertAck}>
                    Acknowledged by {alert.acknowledgedBy.name}
                    {alert.acknowledgedAt ? ` · ${formatWhen(alert.acknowledgedAt)}` : ''}
                  </AppText>
                ) : null}
                {alert.status === 'RESOLVED' && alert.resolvedAt ? (
                  <AppText variant="meta" style={styles.alertAck}>
                    Resolved {formatWhen(alert.resolvedAt)}
                    {alert.resolvedBy ? ` by ${alert.resolvedBy.name}` : ''}
                  </AppText>
                ) : null}

                {open ? (
                  <Button
                    title="Cancel this alert"
                    variant="secondary"
                    loading={cancel.isPending}
                    onPress={() => confirmCancel(alert.id)}
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {openAlert ? (
        <AppText style={styles.openHint}>
          An alert is still open. Keep your phone nearby — guards may call you.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WARM_BG,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    color: palette.textLight,
    fontWeight: '600',
  },
  eyebrow: {
    color: EMERGENCY_RED,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.textLight,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: palette.mutedLight,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  panicCard: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: spacing.sm,
  },
  sectionLabel: {
    color: palette.textLight,
    fontWeight: '700',
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kindTileWrap: {
    width: '47%',
    flexGrow: 1,
  },
  kindTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: palette.surfaceLight,
    paddingHorizontal: spacing.md,
  },
  kindTileActive: {
    borderColor: EMERGENCY_RED,
    backgroundColor: SOFT_RED,
  },
  kindLabel: {
    color: palette.mutedLight,
    fontWeight: '700',
  },
  kindLabelActive: {
    color: EMERGENCY_RED,
  },
  noteInput: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: palette.surfaceLight,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 15,
    color: palette.textLight,
    textAlignVertical: 'top',
  },
  panicButton: {
    marginTop: spacing.sm,
    minHeight: 60,
    borderRadius: radius.xl,
    backgroundColor: EMERGENCY_RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  panicButtonDisabled: {
    opacity: 0.6,
  },
  panicButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  panicHint: {
    color: palette.mutedLight,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    gap: 2,
    marginTop: spacing.xs,
  },
  sectionCopy: {
    color: palette.mutedLight,
  },
  stateCard: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  stateTitle: {
    color: palette.textLight,
    fontWeight: '700',
  },
  stateCopy: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: spacing.sm,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: SOFT_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertKind: {
    color: palette.textLight,
    fontSize: 16,
    fontWeight: '800',
  },
  alertMeta: {
    color: palette.mutedLight,
  },
  alertLocation: {
    color: palette.textLight,
    lineHeight: 20,
  },
  alertAck: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  openHint: {
    color: EMERGENCY_RED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
