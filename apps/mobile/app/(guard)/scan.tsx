import { Button, Card, Pill, palette } from '@smartresidence/ui-mobile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  type GuardVerifiedVisitor,
  VisitorGuardPassCard,
  guardPassSummary,
} from '../../src/components/visitor-guard-pass';
import { api } from '../../src/lib/api';
import { enqueueCheckIn, flushQueue, pendingCount } from '../../src/lib/guard-queue';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

export default function ScanScreen() {
  const { isTablet, isLandscape, contentMaxWidth } = useTabletLayout();
  const [permission, requestPermission] = useCameraPermissions();
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

  if (!permission) return <View style={{ flex: 1, backgroundColor: palette.bgLight }} />;
  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          backgroundColor: palette.bgLight,
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
          Camera permission needed
        </Text>
        <Text style={{ color: palette.mutedLight, marginBottom: 16 }}>
          Guards scan visitor QR passes at the gate.
        </Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  async function confirmCheckIn(pass: string, v: GuardVerifiedVisitor) {
    try {
      await api.checkInVisitor(pass, { gateLocation: 'Main gate' });
      Alert.alert('Welcome', `${v.name} checked in.`);
      setVisitor(null);
      setScannedPass(null);
    } catch {
      await enqueueCheckIn({ qrCode: pass, gateLocation: 'Main gate' });
      Alert.alert('Queued', 'Network unavailable — check-in will sync automatically.');
      setPending(await pendingCount());
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
      if (!isTablet) {
        Alert.alert('Confirm check-in', guardPassSummary(v), [
          { text: 'Cancel', style: 'cancel', onPress: () => setVisitor(null) },
          { text: 'Check in', onPress: () => void confirmCheckIn(value, v) },
        ]);
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Unknown pass', (err as Error).message);
      setVisitor(null);
      setScannedPass(null);
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  }

  const splitView = isTablet && isLandscape;

  return (
    <View style={{ flex: 1, flexDirection: splitView ? 'row' : 'column', backgroundColor: '#000' }}>
      <View style={{ flex: splitView ? 1.3 : 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(e) => onScan(e.data)}
        />
        <View style={{ position: 'absolute', top: 16, left: 16, right: splitView ? 16 : 16 }}>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700' }}>Scan a visitor QR</Text>
              <Pill
                tone={pending > 0 ? 'warning' : 'success'}
                label={pending > 0 ? `${pending} queued` : 'online'}
              />
            </View>
          </Card>
        </View>
      </View>

      {splitView ? (
        <View
          style={{
            flex: 0.7,
            backgroundColor: palette.bgLight,
            padding: 24,
            justifyContent: 'center',
          }}
        >
          {visitor && scannedPass ? (
            <VisitorGuardPassCard
              visitor={visitor}
              onCheckIn={() => void confirmCheckIn(scannedPass, visitor)}
              checkInDisabled={visitor.status !== 'APPROVED'}
            />
          ) : (
            <Text style={{ color: palette.mutedLight, textAlign: 'center' }}>
              Scan a QR code to see visitor details and check in.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
