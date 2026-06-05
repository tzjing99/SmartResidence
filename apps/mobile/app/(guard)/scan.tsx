import { Button, Card, Pill, palette } from '@smartresidence/ui-mobile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { enqueueCheckIn, flushQueue, pendingCount } from '../../src/lib/guard-queue';

type VerifiedVisitor = {
  name: string;
  accessCode?: string;
  unit?: { identifier?: string; block?: { name?: string } };
  expectedAt?: string;
};

function unitLabel(visitor: VerifiedVisitor) {
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  return unit ?? '—';
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

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
        style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: palette.bgLight }}
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

  async function confirmCheckIn(pass: string, visitor: VerifiedVisitor) {
    try {
      await api.checkInVisitor(pass, { gateLocation: 'Main gate' });
      Alert.alert('Welcome', `${visitor.name} checked in.`);
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
      const visitor = (await api.verifyQr(value)) as VerifiedVisitor;
      Alert.alert(
        'Confirm check-in',
        `${visitor.name}\nUnit: ${unitLabel(visitor)}\nCode: ${visitor.accessCode ?? '—'}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Check in', onPress: () => void confirmCheckIn(value, visitor) },
        ],
      );
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Unknown pass', (err as Error).message);
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(e) => onScan(e.data)}
      />
      <View style={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
        <Card>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
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
  );
}
