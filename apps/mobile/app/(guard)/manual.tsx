import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../src/lib/api';
import { enqueueCheckIn } from '../../src/lib/guard-queue';

type VerifiedVisitor = {
  name: string;
  accessCode?: string;
  unit?: { identifier?: string; block?: { name?: string } };
};

function unitLabel(visitor: VerifiedVisitor) {
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  return unit ?? '—';
}

export default function ManualScreen() {
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');

  async function submit() {
    if (!code) return;
    const pass = code.trim();
    try {
      const visitor = (await api.verifyQr(pass)) as VerifiedVisitor;
      Alert.alert(
        'Confirm check-in',
        `${visitor.name}\nUnit: ${unitLabel(visitor)}\nCode: ${visitor.accessCode ?? pass.toUpperCase()}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Check in',
            onPress: async () => {
              try {
                await api.checkInVisitor(pass, {
                  gateLocation: 'Main gate (manual)',
                  notes,
                });
                Alert.alert('Checked in', `${visitor.name} is now on-site.`);
              } catch {
                await enqueueCheckIn({
                  qrCode: pass,
                  gateLocation: 'Main gate (manual)',
                  notes,
                });
                Alert.alert('Queued', 'Network unavailable — will sync when online.');
              }
              setCode('');
              setNotes('');
            },
          },
        ],
      );
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
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Access code or QR token</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. ABC123"
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
          <Button title="Look up pass" onPress={submit} />
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
