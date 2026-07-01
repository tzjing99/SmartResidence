import { isVisitorBlacklistError } from '@smartresidence/shared-types';
import { Button, Card, Pill, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
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
  GUARD_SOFT_CORAL,
  GUARD_WARM_BG,
  GuardBrandBar,
  guardStyles,
} from '../../src/components/guard-screen';
import {
  type GuardVerifiedVisitor,
  VisitorGuardPassCard,
  guardPassSummary,
} from '../../src/components/visitor-guard-pass';
import { api } from '../../src/lib/api';
import { enqueueCheckIn, flushQueue, pendingCount } from '../../src/lib/guard-queue';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

export default function ScanScreen() {
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
  const [scannedPass, setScannedPass] = useState<string | null>(null);
  const [visitor, setVisitor] = useState<GuardVerifiedVisitor | null>(null);

  useEffect(() => {
    void pendingCount().then(setPending);
    const t = setInterval(() => {
      void flushQueue().then(() => pendingCount().then(setPending));
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  async function confirmCheckIn(pass: string, v: GuardVerifiedVisitor) {
    try {
      await api.checkInVisitor(pass, { gateLocation: 'Main gate' });
      Alert.alert('Welcome', `${v.name} checked in.`);
      setVisitor(null);
      setScannedPass(null);
      setActiveScanning(false);
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Visitor blocked', message);
        setVisitor(null);
        setScannedPass(null);
        return;
      }
      await enqueueCheckIn({ qrCode: pass, gateLocation: 'Main gate' });
      Alert.alert('Queued', 'Network unavailable — check-in will sync automatically.');
      setPending(await pendingCount());
    }
  }

  async function confirmRecurringCheckIn(pass: string, guestName: string) {
    try {
      await api.checkInRecurringPass(pass, { gateLocation: 'Main gate' });
      Alert.alert('Welcome', `${guestName} checked in.`);
    } catch (err) {
      const message = (err as Error).message;
      Alert.alert(
        isVisitorBlacklistError(message) ? 'Visitor blocked' : 'Check-in failed',
        message,
      );
    } finally {
      setVisitor(null);
      setScannedPass(null);
      setActiveScanning(false);
    }
  }

  /** Fall back to a recurring pass when the QR is not a one-off visitor pass. */
  async function tryRecurringScan(pass: string): Promise<boolean> {
    try {
      const recurring = await api.verifyRecurringPass(pass);
      setActiveScanning(false);
      const summary = `${recurring.guestName}${recurring.unitLabel ? ` \u00b7 ${recurring.unitLabel}` : ''}`;
      if (!recurring.withinSchedule) {
        Alert.alert(
          'Outside schedule',
          recurring.scheduleMessage ?? `${summary} is not valid right now.`,
        );
        return true;
      }
      Alert.alert('Confirm check-in', `${summary} (recurring pass)`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check in',
          onPress: () => void confirmRecurringCheckIn(pass, recurring.guestName),
        },
      ]);
      return true;
    } catch (err) {
      if (isVisitorBlacklistError((err as Error).message)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Visitor blocked', (err as Error).message);
        return true;
      }
      return false;
    }
  }

  async function onScan(value: string) {
    if (busy || value === last) return;
    setBusy(true);
    setLast(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const v = (await api.verifyQr(value)) as GuardVerifiedVisitor;
      setScannedPass(value);
      setVisitor(v);
      setActiveScanning(false);
      if (!isTablet) {
        Alert.alert('Confirm check-in', guardPassSummary(v), [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setVisitor(null);
              setScannedPass(null);
            },
          },
          { text: 'Check in', onPress: () => void confirmCheckIn(value, v) },
        ]);
      }
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Visitor blocked', message);
        setVisitor(null);
        setScannedPass(null);
      } else {
        // Not a one-off pass — it may be a recurring pass QR.
        const handled = await tryRecurringScan(value);
        if (!handled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Unknown pass', message);
          setVisitor(null);
          setScannedPass(null);
        }
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

  function openManualEntry() {
    router.push('/(guard)/manual' as Href);
  }

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
                Scan visitor pass
              </Text>
              <Text style={{ color: palette.mutedLight, fontSize: 13, marginTop: 3 }}>
                Place the QR code inside the frame.
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
              You can stop the camera at any time and use manual entry if the pass is damaged.
            </Text>
            <View style={{ flexDirection: twoColumn ? 'row' : 'column', gap: 10, marginTop: 14 }}>
              <Button
                title="Stop scanning"
                variant="secondary"
                onPress={stopScanning}
                style={{ flex: 1 }}
              />
              <Button
                title="Manual entry"
                variant="soft-primary"
                onPress={openManualEntry}
                style={{ flex: 1 }}
              />
            </View>
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
            Guard scan
          </Text>
          <Pill
            tone={pending > 0 ? 'warning' : 'success'}
            label={pending > 0 ? `${pending} queued` : 'online'}
          />
        </View>
        <Text style={{ color: palette.mutedLight, fontSize: 14 }}>
          Verify visitor passes at the gate when you are ready to use the camera.
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
                  ? 'Enable camera access in system settings to scan visitor QR passes.'
                  : 'SmartResidence uses the camera only while you are actively scanning a visitor pass.'}
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
                <Button title="Use manual entry" variant="secondary" onPress={openManualEntry} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.qrIcon}>
                <Text style={{ color: palette.coralPrimary, fontSize: 28, fontWeight: '800' }}>
                  QR
                </Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: palette.textLight }}>
                Ready to scan visitor pass
              </Text>
              <Text
                style={{ color: palette.mutedLight, fontSize: 14, marginTop: 8, lineHeight: 20 }}
              >
                Start the camera only when a visitor is at the guard post. The scanner closes after
                a valid pass is found.
              </Text>
              <View style={{ gap: 10, marginTop: 20 }}>
                <Button title="Start scanning" size="lg" onPress={() => void startScanning()} />
                <Button title="Manual entry" variant="secondary" onPress={openManualEntry} />
              </View>
            </>
          )}
        </Card>

        <View
          style={{
            flex: 1,
            minHeight: visitor && scannedPass ? undefined : 220,
            justifyContent: 'center',
          }}
        >
          {visitor && scannedPass ? (
            <VisitorGuardPassCard
              visitor={visitor}
              onCheckIn={() => void confirmCheckIn(scannedPass, visitor)}
              checkInDisabled={visitor.status !== 'APPROVED'}
              checkInLabel="Check in"
            />
          ) : (
            <Card style={[guardStyles.card, styles.placeholderCard]}>
              <Text style={styles.placeholderTitle}>Ready when you are</Text>
              <Text style={styles.placeholderCopy}>
                Tap Start scanning to verify a visitor pass. Details will appear here before
                check-in.
              </Text>
            </Card>
          )}
        </View>
      </View>
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
  placeholderCard: {
    minHeight: 220,
    justifyContent: 'center',
    backgroundColor: GUARD_WARM_BG,
    borderWidth: 1,
    borderColor: guardStyles.card.borderColor,
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.textLight,
  },
  placeholderCopy: {
    color: palette.mutedLight,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
});
