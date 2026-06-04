import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Pill, Stack, Button, palette } from '@smartresidence/ui-mobile';
import { formatMoney } from '@smartresidence/shared-types';
import {
  useCondoAnnouncements,
  useMyCondos,
  useMyUnits,
  useUnitInvoices,
  useUnitVisitors,
} from '@smartresidence/api-client';
import { api } from '../../src/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const condo = condos.data?.[0];
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const announcements = useCondoAnnouncements(api, condo?.id ?? null);

  const openInvoice = (invoices.data?.items as any[] | undefined)?.find(
    (i) => i.status !== 'PAID' && i.status !== 'VOID',
  );
  const upcomingVisitors = ((visitors.data?.items as any[]) ?? []).slice(0, 3);
  const announcement = (announcements.data?.items as any[] | undefined)?.[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <View>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>
          Hi{unit ? `, ${unit.identifier}` : ''}.
        </Text>
        <Text style={{ color: palette.mutedLight, marginTop: 4 }}>
          {condo?.name ?? 'SmartResidence'}
        </Text>
      </View>

      <Card>
        <Text style={{ color: palette.mutedLight, fontSize: 13 }}>Outstanding fee</Text>
        {openInvoice ? (
          <>
            <Text style={{ fontSize: 28, fontWeight: '700', marginTop: 6 }}>
              {formatMoney(openInvoice.total, openInvoice.currencyCode ?? 'MYR')}
            </Text>
            <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
              {openInvoice.number} · due {new Date(openInvoice.dueDate).toLocaleDateString()}
            </Text>
            <View style={{ marginTop: 12 }}>
              <Button
                title="Pay now"
                onPress={() => router.push('/(resident)/billing')}
              />
            </View>
          </>
        ) : (
          <Text style={{ marginTop: 8, color: palette.mutedLight }}>All clear — nothing due.</Text>
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '600' }}>Upcoming visitors</Text>
          <Pill tone="primary" label={`${upcomingVisitors.length}`} />
        </View>
        {upcomingVisitors.length === 0 ? (
          <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
            None expected. Pre-register a guest from the Visitors tab.
          </Text>
        ) : (
          <Stack gap={10}>
            {upcomingVisitors.map((v) => (
              <View key={v.id}>
                <Text style={{ fontWeight: '600' }}>{v.name}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12 }}>
                  {new Date(v.expectedAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </Stack>
        )}
        <View style={{ marginTop: 12 }}>
          <Button
            title="Pre-register a visitor"
            variant="secondary"
            onPress={() => router.push('/(resident)/visitors')}
          />
        </View>
      </Card>

      {announcement ? (
        <Card>
          <Text style={{ color: palette.mutedLight, fontSize: 13 }}>Latest announcement</Text>
          <Text style={{ fontWeight: '600', marginTop: 6, fontSize: 16 }}>{announcement.title}</Text>
          <Text numberOfLines={3} style={{ marginTop: 6, color: palette.textLight, fontSize: 13 }}>
            {announcement.body}
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
