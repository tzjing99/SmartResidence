import { useCollectParcel, useMyUnits, useUnitParcels } from '@smartresidence/api-client';
import type { ParcelStatus } from '@smartresidence/shared-types';
import { PARCEL_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  FadeInView,
  Pill,
  SkeletonList,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useCallback } from 'react';
import { Alert, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

const STATUS_TONE: Record<ParcelStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  RECEIVED: 'neutral',
  NOTIFIED: 'warning',
  COLLECTED: 'success',
  OVERDUE: 'danger',
};

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ParcelsScreen() {
  const { colors } = useTheme();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const parcels = useUnitParcels(api, unit?.id ?? null, { pendingOnly: true });
  const collectParcel = useCollectParcel(api);

  const { refreshControl } = usePullToRefresh(
    useCallback(() => Promise.all([units.refetch(), parcels.refetch()]), [parcels, units]),
  );

  function confirmCollect(id: string) {
    Alert.alert('Confirm collection', 'Have you picked up this parcel from the lobby?', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Collected',
        onPress: () => {
          void collectParcel
            .mutateAsync({ id })
            .then(() => {
              hapticSuccess();
              Alert.alert('Done', 'Thanks — marked as collected.');
            })
            .catch((err) => {
              hapticError();
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not update');
            });
        },
      },
    ]);
  }

  return (
    <ResidentScreen
      eyebrow="Home"
      title="Parcels"
      subtitle="Packages waiting at the lobby"
      scrollProps={{ refreshControl }}
    >
      {parcels.isLoading ? (
        <SkeletonList rows={2} rowHeight={100} />
      ) : (parcels.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No parcels waiting"
          description="When security logs a delivery for your unit, it will appear here."
        />
      ) : (
        <View style={{ gap: 12 }}>
          <ResidentSectionHeader title="Awaiting pickup" />
          {parcels.data?.items.map((p, index) => (
            <FadeInView key={p.id} index={index}>
              <Card style={[residentStyles.card, { gap: 8 }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppText variant="label">{p.recipientName}</AppText>
                  <Pill tone={STATUS_TONE[p.status]} label={PARCEL_STATUS_LABELS[p.status]} />
                </View>
                <AppText variant="meta" style={{ color: colors.muted }}>
                  {p.carrier ?? 'Delivery'}
                  {p.trackingRef ? ` · ${p.trackingRef}` : ''}
                </AppText>
                <AppText variant="meta" style={{ color: colors.muted }}>
                  Received {fmtDateTime(p.receivedAt)}
                </AppText>
                {p.notes ? (
                  <AppText variant="bodySm" style={{ color: colors.muted }}>
                    {p.notes}
                  </AppText>
                ) : null}
                <Button
                  title="I collected this"
                  onPress={() => confirmCollect(p.id)}
                  disabled={collectParcel.isPending}
                />
              </Card>
            </FadeInView>
          ))}
        </View>
      )}
    </ResidentScreen>
  );
}
