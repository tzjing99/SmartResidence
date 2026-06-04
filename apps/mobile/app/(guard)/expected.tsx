import { Alert, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useMyCondos } from '@smartresidence/api-client';
import { api } from '../../src/lib/api';

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

  async function checkIn(qrCode: string, name: string) {
    try {
      await api.checkInVisitor(qrCode, { gateLocation: 'Main gate' });
      Alert.alert('Checked in', `${name} is in.`);
      visitors.refetch();
    } catch (err) {
      Alert.alert('Could not check in', (err as Error).message);
    }
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
                  {v.unit?.identifier ?? '—'} · {new Date(v.expectedAt).toLocaleString()}
                </Text>
                {v.vehiclePlate ? (
                  <Pill tone="neutral" label={v.vehiclePlate} />
                ) : null}
              </View>
              <Button
                title="Check in"
                size="sm"
                onPress={() => checkIn(v.qrCode, v.name)}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
