import { useMyCondos } from '@smartresidence/api-client';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { UnitSearchPicker, type UnitSearchItem } from '../../src/components/unit-search-picker';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

type Tab = 'unit' | 'office';

export default function WalkInScreen() {
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [tab, setTab] = useState<Tab>('unit');
  const [unit, setUnit] = useState<UnitSearchItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitUnit() {
    if (!unit?.id || !name.trim()) {
      Alert.alert('Unit required', 'Search and select the unit the visitor is going to.');
      return;
    }
    setBusy(true);
    try {
      await api.createWalkInUnit({
        unitId: unit.id,
        name: name.trim(),
        phone: phone || undefined,
        purpose: purpose || undefined,
      });
      Alert.alert('Sent for approval', 'Unit owner has 15 minutes to respond.');
      setName('');
      setPhone('');
      setPurpose('');
      setUnit(null);
    } catch (err) {
      Alert.alert('Could not register', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOffice() {
    if (!name.trim() || !purpose.trim()) {
      Alert.alert('Purpose required', 'Enter why the visitor is seeing management.');
      return;
    }
    setBusy(true);
    try {
      await api.createWalkInOffice({
        name: name.trim(),
        phone: phone || undefined,
        purpose: purpose.trim(),
        gateLocation: 'Management office',
      });
      Alert.alert('Logged in', `${name.trim()} checked in at management office.`);
      setName('');
      setPhone('');
      setPurpose('');
    } catch (err) {
      Alert.alert('Could not log visitor', (err as Error).message);
    } finally {
      setBusy(false);
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
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Walk-in visitor</Text>
        {condo ? <Text style={{ color: palette.mutedLight, fontSize: 12 }}>{condo.name}</Text> : null}
        <Text style={{ color: palette.mutedLight, fontSize: 14 }}>
          One visit — validated once at the gate. Security opens the gate; the owner meets the
          visitor. Overnight stays are not available for walk-ins — use pre-registration instead.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Unit"
            variant={tab === 'unit' ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTab('unit')}
          />
          <Button
            title="Management office"
            variant={tab === 'office' ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTab('office')}
          />
        </View>

        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Visitor name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Full name" style={inputStyle} />
          <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Phone (optional)</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="+60…" style={inputStyle} />
          {tab === 'unit' ? (
            <>
              <View style={{ marginTop: 12 }}>
                <UnitSearchPicker
                  condoId={condo?.id}
                  value={unit}
                  onChange={setUnit}
                  label="Unit"
                  placeholder="Search block, unit, or resident…"
                />
              </View>
              <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                Purpose (optional)
              </Text>
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Visiting reason"
                style={inputStyle}
              />
              <View style={{ marginTop: 16 }}>
                <Button
                  title={busy ? 'Sending…' : 'Request owner approval'}
                  onPress={submitUnit}
                  loading={busy}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                Purpose (required)
              </Text>
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                placeholder="e.g. Parcel collection, AGM enquiry"
                style={inputStyle}
              />
              <View style={{ marginTop: 16 }}>
                <Button
                  title={busy ? 'Logging…' : 'Log & check in'}
                  onPress={submitOffice}
                  loading={busy}
                />
              </View>
            </>
          )}
        </Card>
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
