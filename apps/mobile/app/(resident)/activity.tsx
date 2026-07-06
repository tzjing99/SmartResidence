import { useMyActivity, useWhoViewedMe } from '@smartresidence/api-client';
import { AppText, Card, EmptyState, palette } from '@smartresidence/ui-mobile';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';

export default function ActivityScreen() {
  const t = useT();
  const activity = useMyActivity(api);
  const whoViewed = useWhoViewedMe(api);
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () => Promise.all([activity.refetch(), whoViewed.refetch()]),
      [activity, whoViewed],
    ),
  );

  const items = (activity.data?.items as any[]) ?? [];
  const views = (whoViewed.data?.items as any[]) ?? [];

  return (
    <ResidentScreen
      eyebrow={t('nav.activity')}
      title={t('nav.screens.activity')}
      subtitle="A clear audit trail of actions and record views connected to your home."
      scrollProps={{ refreshControl }}
    >
      <ResidentSectionHeader
        title="Recent actions"
        subtitle="Every action that touches your unit, in your hands."
      />

      {items.length === 0 ? (
        <EmptyState title="Nothing yet" description="Actions on your unit show up here." />
      ) : (
        items.map((row) => (
          <Card key={row.id} style={residentStyles.card}>
            <View style={{ gap: 3 }}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                {prettyLabel(row.action)} · {prettyLabel(row.resourceType)}
              </AppText>
              <AppText variant="meta" style={{ color: palette.mutedLight }}>
                {row.actor?.name ?? 'System'}
                {row.actorRole ? ` · ${prettyLabel(row.actorRole)}` : ''}
                {' · '}
                {new Date(row.createdAt).toLocaleString()}
              </AppText>
            </View>
          </Card>
        ))
      )}

      <ResidentSectionHeader
        title="Who viewed my data"
        subtitle="If staff open your records, you will know."
      />
      {views.length === 0 ? (
        <EmptyState title="No views yet" description="If staff open your records, you'll know." />
      ) : (
        views.map((row) => (
          <Card key={row.id} style={residentStyles.card}>
            <View style={{ gap: 3 }}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                {row.actor?.name ?? 'Unknown'} viewed {prettyLabel(row.resourceType)}
              </AppText>
              <AppText variant="meta" style={{ color: palette.mutedLight }}>
                {row.actor?.name ?? 'System'}
                {row.actorRole ? ` · ${prettyLabel(row.actorRole)}` : ''}
                {' · '}
                {new Date(row.createdAt).toLocaleString()}
              </AppText>
            </View>
          </Card>
        ))
      )}
    </ResidentScreen>
  );
}
