import { useCheckOutVisitor, useGuardLiveVisitors, useMyCondos } from '@smartresidence/api-client';
import {
  malaysiaPhoneTelHref,
  pickOwnerPhone,
} from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { api } from '../../src/lib/api';

function formatTimeOnSite(checkedInAt: Date, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - checkedInAt.getTime()) / 60_000));
  if (mins < 1) return 'Just in';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function visitTypeLabel(visitType: string): string {
  switch (visitType) {
    case 'PRE_REG':
      return 'Pre-reg';
    case 'WALKIN_UNIT':
      return 'Walk-in';
    case 'WALKIN_OFFICE':
      return 'Office';
    default:
      return visitType;
  }
}

export default function LiveScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const live = useGuardLiveVisitors(api, condo?.id);
  const checkOut = useCheckOutVisitor(api);
  const items = live.data?.items ?? [];

  function callPhone(phone: string) {
    const href = malaysiaPhoneTelHref(phone);
    if (href) void Linking.openURL(href);
  }

  function confirmCheckOut(visitorId: string, name: string) {
    Alert.alert('Check out visitor?', 'Are you sure? They will leave the live board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, check out',
        style: 'destructive',
        onPress: () => {
          void checkOut.mutateAsync(visitorId).then(
            () => Alert.alert('Checked out', `${name} has left the premises.`),
            (err: Error) => Alert.alert('Could not check out', err.message),
          );
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}
    >
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={{ fontSize: 48, fontWeight: '800', color: palette.coralPrimary }}>
          {live.isLoading ? '—' : (live.data?.total ?? 0)}
        </Text>
        <Text style={{ color: palette.mutedLight, fontSize: 13, fontWeight: '600' }}>
          on site now
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState title="No visitors on site" />
      ) : (
        items.map((v) => {
          const owner = pickOwnerPhone(v.ownerContacts);
          const checkedInAt = new Date(v.checkedInAt);
          return (
            <Card key={v.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>{v.name}</Text>
                  <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                    {v.unitLabel ?? '—'} · {formatTimeOnSite(checkedInAt)}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <Pill tone="neutral" label={visitTypeLabel(v.visitType)} />
                    {v.overnight ? <Pill tone="warning" label="Overnight" /> : null}
                    {v.vehiclePlate ? <Pill tone="neutral" label={v.vehiclePlate} /> : null}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {v.phone?.trim() ? (
                  <Button
                    title={`Call visitor · ${v.phone}`}
                    size="sm"
                    onPress={() => callPhone(v.phone!)}
                  />
                ) : null}
                {owner?.phone ? (
                  <Button
                    title={`Call ${owner.name}`}
                    size="sm"
                    variant="secondary"
                    onPress={() => callPhone(owner.phone!)}
                  />
                ) : null}
                <Button
                  title="Check out"
                  size="sm"
                  variant="secondary"
                  loading={checkOut.isPending}
                  onPress={() => confirmCheckOut(v.id, v.name)}
                />
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
