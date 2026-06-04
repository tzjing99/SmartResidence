import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { api } from '../../src/lib/api';
import { enqueueCheckIn } from '../../src/lib/guard-queue';

export default function ManualScreen() {
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');

  async function submit() {
    if (!code) return;
    try {
      await api.verifyQr(code);
      try {
        await api.checkInVisitor(code, { gateLocation: 'Main gate (manual)', notes });
        Alert.alert('Checked in');
      } catch {
        await enqueueCheckIn({ qrCode: code, gateLocation: 'Main gate (manual)', notes });
        Alert.alert('Queued', 'Network unavailable — will sync when online.');
      }
      setCode('');
      setNotes('');
    } catch (err) {
      Alert.alert('Unknown pass', (err as Error).message);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Manual check-in</Text>
      <Card>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Pass code</Text>
        <TextInput
          autoCapitalize="none"
          value={code}
          onChangeText={setCode}
          placeholder="QR string from visitor"
          style={inputStyle}
        />
        <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          style={[inputStyle, { height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
          multiline
        />
        <View style={{ marginTop: 16 }}>
          <Button title="Check in" onPress={submit} />
        </View>
      </Card>
    </ScrollView>
  );
}

const inputStyle = {
  height: 44,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
