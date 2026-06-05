import {
  useApproveVisitor,
  useCreateVisitor,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import { Button, Card, EmptyState, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../src/lib/api';

export default function VisitorsScreen() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const create = useCreateVisitor(api);
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);

  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');

  async function pre() {
    if (!unit || !name) return;
    try {
      await create.mutateAsync({
        unitId: unit.id,
        name,
        vehiclePlate: plate || undefined,
        expectedAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      setName('');
      setPlate('');
    } catch (err) {
      Alert.alert('Could not create visitor', (err as Error).message);
    }
  }

  async function onApprove(id: string) {
    try {
      await approve.mutateAsync(id);
      Alert.alert('Approved', 'Guard may check the visitor in.');
    } catch (err) {
      Alert.alert('Could not approve', (err as Error).message);
    }
  }

  async function onReject(id: string) {
    try {
      await reject.mutateAsync({ visitorId: id });
      Alert.alert('Rejected', 'Guard has been notified.');
    } catch (err) {
      Alert.alert('Could not reject', (err as Error).message);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Visitors</Text>

      <Card>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Quick pre-register</Text>
        <TextInput
          placeholder="Visitor name"
          value={name}
          onChangeText={setName}
          style={inputStyle}
        />
        <TextInput
          placeholder="Plate (optional)"
          value={plate}
          onChangeText={setPlate}
          style={[inputStyle, { marginTop: 10 }]}
        />
        <View style={{ marginTop: 12 }}>
          <Button
            title={create.isPending ? 'Creating…' : 'Create pass'}
            loading={create.isPending}
            onPress={pre}
          />
        </View>
      </Card>

      {(visitors.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No visitors yet"
          description="Pre-registered visitors and their QR passes show up here."
        />
      ) : (
        ((visitors.data?.items as any[]) ?? []).map((v) => (
          <Card key={v.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontWeight: '600' }}>{v.name}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  {new Date(v.expectedAt).toLocaleString()}
                </Text>
                {v.accessCode ? (
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      letterSpacing: 2,
                      marginTop: 8,
                    }}
                  >
                    {v.accessCode}
                  </Text>
                ) : null}
                <View style={{ marginTop: 8, flexDirection: 'row' }}>
                  <Pill
                    tone={
                      v.status === 'CHECKED_IN'
                        ? 'success'
                        : v.status === 'PENDING_OWNER_APPROVAL'
                          ? 'warning'
                          : v.status === 'CANCELLED' || v.status === 'REJECTED'
                            ? 'danger'
                            : 'primary'
                    }
                    label={v.status.toLowerCase().replace(/_/g, ' ')}
                  />
                </View>
                {v.status === 'PENDING_OWNER_APPROVAL' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Button title="Approve" size="sm" onPress={() => onApprove(v.id)} />
                    <Button
                      title="Reject"
                      size="sm"
                      variant="secondary"
                      onPress={() => onReject(v.id)}
                    />
                  </View>
                ) : null}
              </View>
              {v.qrPayload || v.qrCode ? (
                <View style={{ borderRadius: radius.md, padding: 6, backgroundColor: '#fff' }}>
                  <QRCode value={v.qrPayload ?? v.qrCode} size={80} />
                </View>
              ) : null}
            </View>
          </Card>
        ))
      )}
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
