import { useCheckOutVisitor, useGuardLiveVisitors, useMyCondos } from '@smartresidence/api-client';
import {
  formatMalaysiaPhoneDisplay,
  malaysiaPhoneTelHref,
  pickOwnerPhone,
} from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useCallback } from 'react';
import { Alert, FlatList, Linking, Text, View, type ListRenderItemInfo } from 'react-native';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

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
  const { contentMaxWidth, horizontalPadding, twoColumn } = useTabletLayout();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const live = useGuardLiveVisitors(api, condo?.id);
  const checkOut = useCheckOutVisitor(api);
  const items = live.data?.items ?? [];

  const callPhone = useCallback((phone: string) => {
    const href = malaysiaPhoneTelHref(phone);
    if (href) void Linking.openURL(href);
  }, []);

  const confirmCheckOut = useCallback((visitorId: string, name: string) => {
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
  }, [checkOut]);

  const renderItem = useCallback(
    ({ item: v }: ListRenderItemInfo<(typeof items)[number]>) => {
      const owner = pickOwnerPhone(v.ownerContacts);
      const checkedInAt = new Date(v.checkedInAt);
      const visitorPhone = formatMalaysiaPhoneDisplay(v.phone);
      const ownerPhone = owner?.phone ? formatMalaysiaPhoneDisplay(owner.phone) : null;
      return (
        <View style={{ flex: 1, minWidth: twoColumn ? 280 : undefined }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{v.name}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  {v.unitLabel ?? '—'} · {formatTimeOnSite(checkedInAt)}
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
                >
                  <Pill tone="neutral" label={visitTypeLabel(v.visitType)} />
                  {v.overnight ? <Pill tone="warning" label="Overnight" /> : null}
                  {v.vehiclePlate ? <Pill tone="neutral" label={v.vehiclePlate} /> : null}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {visitorPhone ? (
                <Button
                  title={`Call visitor · ${visitorPhone}`}
                  size="sm"
                  onPress={() => callPhone(v.phone!)}
                />
              ) : null}
              {ownerPhone ? (
                <Button
                  title={`Call ${owner!.name}`}
                  size="sm"
                  variant="secondary"
                  onPress={() => callPhone(owner!.phone!)}
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
        </View>
      );
    },
    [callPhone, checkOut.isPending, confirmCheckOut, twoColumn],
  );

  return (
    <FlatList
      key={twoColumn ? 'tablet-grid' : 'phone-list'}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={twoColumn ? 2 : 1}
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: horizontalPadding,
        paddingVertical: 20,
        paddingBottom: 40,
        gap: 12,
      }}
      columnWrapperStyle={twoColumn ? { gap: 12 } : undefined}
      ListHeaderComponent={
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontSize: 48, fontWeight: '800', color: palette.coralPrimary }}>
            {live.isLoading ? '—' : (live.data?.total ?? 0)}
          </Text>
          <Text style={{ color: palette.mutedLight, fontSize: 13, fontWeight: '600' }}>
            on site now
          </Text>
        </View>
      }
      ListEmptyComponent={<EmptyState title="No visitors on site" />}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}
