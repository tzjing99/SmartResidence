import { Ionicons } from '@expo/vector-icons';
import {
  useMyCondos,
  usePatrolCheckpoints,
  useScanPatrolCheckpoint,
} from '@smartresidence/api-client';
import type { PatrolCheckpointStatus } from '@smartresidence/shared-types';
import { Button, Card, Pill, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_WARM_BG,
  GuardBrandBar,
  guardStyles,
} from '../../src/components/guard-screen';
import { api } from '../../src/lib/api';
import {
  enqueuePatrolScan,
  flushPatrolQueue,
  pendingPatrolCount,
} from '../../src/lib/patrol-queue';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

function isServerError(err: unknown) {
  return err instanceof Error && err.name === 'ApiError';
}

function formatLastScan(value: Date | string | null | undefined): string {
  if (!value) return 'Not scanned today';
  return `Last ${new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function PatrolScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isTablet, isLandscape, contentMaxWidth, horizontalPadding, twoColumn } =
    useTabletLayout();
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionPrompted, setPermissionPrompted] = useState(false);
  const [activeScanning, setActiveScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const checkpoints = usePatrolCheckpoints(api, condoId);
  const scan = useScanPatrolCheckpoint(api);

  useEffect(() => {
    void pendingPatrolCount().then(setPending);
    const t = setInterval(() => {
      void flushPatrolQueue().then(() => {
        void pendingPatrolCount().then(setPending);
        void checkpoints.refetch();
      });
    }, 15_000);
    return () => clearInterval(t);
  }, [checkpoints.refetch]);

  async function onScan(value: string) {
    if (busy || value === last) return;
    setBusy(true);
    setLast(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const result = await scan.mutateAsync({ code: value, source: 'ONLINE' });
      const name = result.checkpoint?.name ?? 'Checkpoint';
      setActiveScanning(false);
      Alert.alert('Checkpoint logged', `${name} scanned successfully.`);
      void checkpoints.refetch();
    } catch (err) {
      const message = (err as Error).message;
      if (isServerError(err)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Scan rejected', message);
      } else {
        await enqueuePatrolScan({ code: value });
        setPending(await pendingPatrolCount());
        Alert.alert('Queued — will sync', 'Network unavailable. This scan syncs automatically.');
      }
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  }

  async function startScanning() {
    setPermissionPrompted(true);
    if (permission?.granted) {
      setActiveScanning(true);
      return;
    }
    const nextPermission = await requestPermission();
    if (nextPermission.granted) {
      setActiveScanning(true);
    }
  }

  function stopScanning() {
    setActiveScanning(false);
    setBusy(false);
    setLast(null);
  }

  const items = checkpoints.data ?? [];
  const activeCheckpoints = items.filter((c) => c.active);
  const doneToday = activeCheckpoints.filter((c) => c.scansToday > 0).length;
  const overdueCount = activeCheckpoints.filter((c) => c.overdue).length;

  const permissionDenied = permission && !permission.granted && !permission.canAskAgain;
  const shouldShowPermissionCard =
    !activeScanning &&
    permission &&
    !permission.granted &&
    (permissionPrompted || permissionDenied);
  const scannerMaxWidth = isTablet ? Math.min(720, contentMaxWidth) : contentMaxWidth;
  const previewWidth = Math.max(280, Math.min(scannerMaxWidth - horizontalPadding * 2, width - 24));
  const previewHeight = isLandscape
    ? Math.min(420, Math.max(260, height * 0.58))
    : Math.min(previewWidth * 1.16, Math.max(320, height * 0.52));

  if (activeScanning && permission?.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: GUARD_WARM_BG,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 16) + 92,
          paddingHorizontal: horizontalPadding,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: scannerMaxWidth, flex: 1, gap: 14 }}>
          <GuardBrandBar />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: palette.textLight }}>
                Scan checkpoint
              </Text>
              <Text style={{ color: palette.mutedLight, fontSize: 13, marginTop: 3 }}>
                Point the camera at the checkpoint QR tag.
              </Text>
            </View>
            <Pill
              tone={pending > 0 ? 'warning' : 'success'}
              label={pending > 0 ? `${pending} queued` : 'online'}
            />
          </View>

          <View
            style={{
              width: '100%',
              height: previewHeight,
              maxWidth: scannerMaxWidth,
              alignSelf: 'center',
              borderRadius: radius['3xl'],
              overflow: 'hidden',
              backgroundColor: '#111827',
              borderWidth: 1,
              borderColor: 'rgba(17,24,39,0.12)',
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : (e) => void onScan(e.data)}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: '13%',
                right: '13%',
                top: '20%',
                bottom: '20%',
                borderRadius: radius['2xl'],
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.88)',
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            />
          </View>

          <Card style={[guardStyles.card, styles.helperCard]}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: palette.textLight }}>
              Hold steady until the phone vibrates.
            </Text>
            <Text style={{ color: palette.mutedLight, fontSize: 13, marginTop: 5 }}>
              Scans made without signal are queued and synced automatically.
            </Text>
            <Button
              title="Stop scanning"
              variant="secondary"
              onPress={stopScanning}
              style={{ marginTop: 14 }}
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: GUARD_WARM_BG }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: contentMaxWidth,
        alignSelf: 'center',
        paddingTop: Math.max(insets.top, 12) + 8,
        paddingHorizontal: horizontalPadding,
        paddingBottom: Math.max(insets.bottom, 16) + 104,
        gap: 16,
      }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <GuardBrandBar />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: palette.textLight }}>
            Patrol tour
          </Text>
          <Pill
            tone={pending > 0 ? 'warning' : 'success'}
            label={pending > 0 ? `${pending} queued` : 'online'}
          />
        </View>
        <Text style={{ color: palette.mutedLight, fontSize: 14 }}>
          Scan each checkpoint QR tag during your rounds to log the patrol.
        </Text>
      </View>

      <View style={{ flexDirection: twoColumn ? 'row' : 'column', gap: 16 }}>
        <Card style={[guardStyles.card, styles.actionCard]}>
          {shouldShowPermissionCard ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', color: palette.textLight }}>
                {permissionDenied ? 'Camera access is blocked' : 'Camera permission needed'}
              </Text>
              <Text
                style={{ color: palette.mutedLight, fontSize: 14, marginTop: 8, lineHeight: 20 }}
              >
                {permissionDenied
                  ? 'Enable camera access in system settings to scan checkpoint QR tags.'
                  : 'SmartResidence uses the camera only while you are actively scanning a checkpoint.'}
              </Text>
              <View style={{ gap: 10, marginTop: 18 }}>
                <Button
                  title={permissionDenied ? 'Open settings' : 'Grant permission'}
                  onPress={
                    permissionDenied
                      ? () => void Linking.openSettings()
                      : () => void startScanning()
                  }
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.qrIcon}>
                <Ionicons name="walk-outline" size={28} color={GUARD_CORAL} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: palette.textLight }}>
                Ready to scan checkpoint
              </Text>
              <Text
                style={{ color: palette.mutedLight, fontSize: 14, marginTop: 8, lineHeight: 20 }}
              >
                Start the camera at each checkpoint on your route. The scanner closes after a valid
                tag is logged.
              </Text>
              <View style={{ gap: 10, marginTop: 20 }}>
                <Button title="Start scanning" size="lg" onPress={() => void startScanning()} />
              </View>
            </>
          )}
        </Card>

        <Card style={[guardStyles.card, styles.summaryCard]}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={GUARD_CORAL} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.summaryValue}>
                {checkpoints.isLoading ? '—' : `${doneToday} / ${activeCheckpoints.length}`}
              </Text>
              <Text style={styles.summaryCaption}>checkpoints scanned today</Text>
            </View>
            {overdueCount > 0 ? <Pill tone="danger" label={`${overdueCount} overdue`} /> : null}
          </View>
        </Card>
      </View>

      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: palette.textLight }}>
          Checkpoints
        </Text>
        <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
          Green means scanned today. Remaining stops still need a visit.
        </Text>
      </View>

      {checkpoints.isLoading ? (
        <Card style={[guardStyles.card, styles.stateCard]}>
          <Text style={styles.stateCopy}>Loading checkpoints…</Text>
        </Card>
      ) : checkpoints.isError ? (
        <Card style={[guardStyles.card, styles.stateCard]}>
          <Text style={styles.stateTitle}>Could not load checkpoints</Text>
          <Button
            title="Retry"
            variant="secondary"
            onPress={() => void checkpoints.refetch()}
            style={{ marginTop: 10 }}
          />
        </Card>
      ) : activeCheckpoints.length === 0 ? (
        <Card style={[guardStyles.card, styles.stateCard]}>
          <Text style={styles.stateTitle}>No checkpoints set up</Text>
          <Text style={styles.stateCopy}>
            Ask management to add patrol checkpoints for this property.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {activeCheckpoints.map((cp: PatrolCheckpointStatus) => {
            const done = cp.scansToday > 0;
            return (
              <Card key={cp.id} style={[guardStyles.card, styles.checkpointCard]}>
                <View
                  style={[
                    styles.checkpointIcon,
                    { backgroundColor: done ? '#ECFDF5' : GUARD_SOFT_CORAL },
                  ]}
                >
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={done ? '#047857' : GUARD_CORAL}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.checkpointName}>
                    {cp.name}
                  </Text>
                  <Text style={styles.checkpointMeta}>
                    {done ? `Scanned ${cp.scansToday}×` : 'Remaining'} ·{' '}
                    {formatLastScan(cp.lastScanAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {done ? (
                    <Pill tone="success" label="Done" />
                  ) : (
                    <Pill tone="neutral" label="To do" />
                  )}
                  {cp.overdue ? <Pill tone="danger" label="Overdue" /> : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  helperCard: {
    padding: spacing.md,
  },
  actionCard: {
    flex: 1,
    minHeight: 250,
    justifyContent: 'center',
  },
  qrIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    color: palette.textLight,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  summaryCaption: {
    color: palette.mutedLight,
    fontSize: 13,
    fontWeight: '600',
  },
  stateCard: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
  },
  stateTitle: {
    color: palette.textLight,
    fontSize: 16,
    fontWeight: '800',
  },
  stateCopy: {
    color: palette.mutedLight,
    fontSize: 14,
    lineHeight: 20,
  },
  checkpointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkpointIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointName: {
    color: palette.textLight,
    fontSize: 16,
    fontWeight: '800',
  },
  checkpointMeta: {
    color: palette.mutedLight,
    fontSize: 13,
    marginTop: 2,
  },
});
