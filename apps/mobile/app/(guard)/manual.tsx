import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import {
  type GuardVerifiedVisitor,
  VisitorGuardPassCard,
  guardPassSummary,
} from '../../src/components/visitor-guard-pass';
import { api } from '../../src/lib/api';
import { enqueueCheckIn } from '../../src/lib/guard-queue';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

export default function ManualScreen() {
  const { contentMaxWidth, horizontalPadding, twoColumn, isTablet } = useTabletLayout();
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [visitor, setVisitor] = useState<GuardVerifiedVisitor | null>(null);
  const [pass, setPass] = useState('');

  async function lookup() {
    if (!code.trim()) return;
    const trimmed = code.trim();
    try {
      const v = (await api.verifyQr(trimmed)) as GuardVerifiedVisitor;
      setVisitor(v);
      setPass(trimmed);
      if (!isTablet) {
        Alert.alert('Pass found', guardPassSummary(v));
      }
    } catch (err) {
      setVisitor(null);
      setPass('');
      Alert.alert('Unknown pass', (err as Error).message);
    }
  }

  async function checkIn() {
    if (!visitor || !pass) return;
    try {
      await api.checkInVisitor(pass, {
        gateLocation: 'Main gate (manual)',
        notes,
      });
      Alert.alert('Checked in', `${visitor.name} is now on-site.`);
      setCode('');
      setNotes('');
      setVisitor(null);
      setPass('');
    } catch {
      await enqueueCheckIn({
        qrCode: pass,
        gateLocation: 'Main gate (manual)',
        notes,
      });
      Alert.alert('Queued', 'Network unavailable — will sync when online.');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{
        paddingVertical: 20,
        paddingBottom: 40,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          gap: 16,
          flexDirection: twoColumn ? 'row' : 'column',
        }}
      >
        <View style={{ flex: 1, gap: 16 }}>
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
              <Button title="Look up pass" onPress={lookup} />
            </View>
          </Card>
        </View>

        {visitor ? (
          <View style={{ flex: 1 }}>
            <VisitorGuardPassCard
              visitor={visitor}
              onCheckIn={checkIn}
              checkInDisabled={visitor.status !== 'APPROVED'}
            />
          </View>
        ) : null}
      </View>
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
