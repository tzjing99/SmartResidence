import { Button, Card, Pill, palette } from '@smartresidence/ui-mobile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { enqueueCheckIn, flushQueue, pendingCount } from '../../src/lib/guard-queue';

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

  async function onScan(value: string) {
    if (busy || value === last) return;
    setBusy(true);
    setLast(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const visitor = await api.verifyQr(value);
      try {
        await api.checkInVisitor(value, { gateLocation: 'Main gate' });
        Alert.alert('Welcome', `${(visitor as any).name} checked in.`);
      } catch {
        await enqueueCheckIn({ qrCode: value, gateLocation: 'Main gate' });
        Alert.alert('Queued', 'Network unavailable — check-in will sync automatically.');
        setPending(await pendingCount());
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Unknown QR', (err as Error).message);
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
