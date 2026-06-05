import { useMyCondos } from '@smartresidence/api-client';
import { Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useQuery } from '@tanstack/react-query';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api } from '../../src/lib/api';

function passFor(v: { id: string; accessCode?: string; qrPayload?: string; qrCode?: string }) {
  return v.accessCode ?? v.qrPayload ?? v.qrCode ?? v.id;
}

export default function ExpectedScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const visitors = useQuery({
    queryKey: ['guard', 'visitors', condo?.id],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, { status: 'APPROVED', limit: 50 })
        : Promise.resolve({ items: [], total: 0 }),
    refetchInterval: 30_000,
    enabled: Boolean(condo),
  });

  const items = (visitors.data?.items as any[]) ?? [];

  function confirmCheckIn(v: {
    id: string;
    name: string;
    accessCode?: string;
    qrPayload?: string;
    qrCode?: string;
    unit?: { identifier?: string };
  }) {
    const pass = passFor(v);
    Alert.alert('Allow entry', `${v.name}\nUnit: ${v.unit?.identifier ?? '—'}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Check in',
        onPress: async () => {
          try {
            await api.checkInVisitor(pass, { gateLocation: 'Main gate' });
            Alert.alert('Checked in', `${v.name} is in.`);
            visitors.refetch();
          } catch (err) {
            Alert.alert('Could not check in', (err as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Expected today</Text>
      {items.length === 0 ? (
        <EmptyState title="No expected visitors" />
      ) : (
        items.map((v) => (
          <Card key={v.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontWeight: '600' }}>{v.name}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  {v.unit?.identifier ?? 'Office'} · {new Date(v.expectedAt).toLocaleString()}
                </Text>
                {v.accessCode ? (
                  <Text
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      marginTop: 4,
                      letterSpacing: 2,
                    }}
                  >
                    {v.accessCode}
                  </Text>
                ) : null}
                {v.vehiclePlate ? <Pill tone="neutral" label={v.vehiclePlate} /> : null}
              </View>
              <Button title="Allow" size="sm" onPress={() => confirmCheckIn(v)} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
