import { useMyActivity, useWhoViewedMe } from '@smartresidence/api-client';
import { Card, EmptyState, palette } from '@smartresidence/ui-mobile';
import { ScrollView, Text } from 'react-native';
import { api } from '../../src/lib/api';

export default function ActivityScreen() {
  const activity = useMyActivity(api);
  const whoViewed = useWhoViewedMe(api);

  const items = (activity.data?.items as any[]) ?? [];
  const views = (whoViewed.data?.items as any[]) ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Activity on my unit</Text>
      <Text style={{ color: palette.mutedLight, marginTop: -10 }}>
        Every action that touches your unit, in your hands.
      </Text>

      {items.length === 0 ? (
        <EmptyState title="Nothing yet" description="Actions on your unit show up here." />
      ) : (
        items.map((row) => (
          <Card key={row.id}>
            <Text style={{ fontWeight: '600' }}>
              {row.action} · {row.resourceType}
            </Text>
            <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
              {row.actor?.name ?? 'System'}
              {row.actorRole ? ` · ${row.actorRole.replace('_', ' ')}` : ''}
              {' · '}
              {new Date(row.createdAt).toLocaleString()}
            </Text>
          </Card>
        ))
      )}

      <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 12 }}>Who viewed my data</Text>
      {views.length === 0 ? (
        <EmptyState title="No views yet" description="If staff open your records, you'll know." />
      ) : (
        views.map((row) => (
          <Card key={row.id}>
            <Text style={{ fontWeight: '600' }}>
              {row.actor?.name ?? 'Unknown'} viewed {row.resourceType}
            </Text>
            <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
              {new Date(row.createdAt).toLocaleString()}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
