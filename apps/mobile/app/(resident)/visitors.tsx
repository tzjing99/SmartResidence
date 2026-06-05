import {
  useApproveVisitor,
  useCreateFavouriteVisitor,
  useCreateVisitor,
  useDeleteFavouriteVisitor,
  useFavouriteVisitors,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import type { FavouriteVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../src/lib/api';

type VisitorTab = VisitorListView | 'favourites';

const TABS: { id: VisitorTab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history', label: 'History' },
  { id: 'favourites', label: 'Favourites' },
];

export default function VisitorsScreen() {
  const [tab, setTab] = useState<VisitorTab>('upcoming');
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const listView: VisitorListView | undefined =
    tab === 'upcoming' || tab === 'history' ? tab : undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null, listView);
  const favourites = useFavouriteVisitors(api, tab === 'favourites' ? (unit?.id ?? null) : null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Visitors</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: radius.full,
                backgroundColor: active ? 'rgba(255, 90, 95, 0.12)' : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? 'rgba(255, 90, 95, 0.25)' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: active ? palette.coralPrimary : palette.mutedLight,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'favourites' ? (
        <FavouritesTab
          unitId={unit?.id}
          items={(favourites.data?.items ?? []) as FavouriteVisitor[]}
        />
      ) : (
        <VisitorsTab tab={tab} items={(visitors.data?.items ?? []) as Visitor[]} />
      )}
    </ScrollView>
  );
}

function VisitorsTab({ tab, items }: { tab: VisitorListView; items: Visitor[] }) {
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);

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

  if (items.length === 0) {
    return (
      <EmptyState
        title={tab === 'upcoming' ? 'No upcoming visitors' : 'No visit history yet'}
        description={
          tab === 'upcoming'
            ? 'Pre-registered visitors and pending walk-ins show up here.'
            : 'Past check-ins and expired passes appear here.'
        }
      />
    );
  }

  return (
    <>
      {items.map((v) => (
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
              {v.accessCode && tab === 'upcoming' ? (
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
                        : v.status === 'CANCELLED' ||
                            v.status === 'REJECTED' ||
                            v.status === 'EXPIRED'
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
            {tab === 'upcoming' && (v.qrPayload || v.qrCode) ? (
              <View style={{ borderRadius: radius.md, padding: 6, backgroundColor: '#fff' }}>
                <QRCode value={v.qrPayload ?? v.qrCode ?? ''} size={80} />
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );
}

function FavouritesTab({
  unitId,
  items,
}: {
  unitId?: string;
  items: FavouriteVisitor[];
}) {
  const createFav = useCreateFavouriteVisitor(api);
  const deleteFav = useDeleteFavouriteVisitor(api);
  const createVisitor = useCreateVisitor(api);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');

  async function onSave() {
    if (!unitId || !name.trim()) return;
    try {
      await createFav.mutateAsync({
        unitId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        vehiclePlate: plate.trim() || undefined,
      });
      setName('');
      setPhone('');
      setPlate('');
      setShowForm(false);
      Alert.alert('Saved', 'Favourite visitor added.');
    } catch (err) {
      Alert.alert('Could not save', (err as Error).message);
    }
  }

  async function onQuickPass(fav: FavouriteVisitor) {
    if (!unitId) return;
    try {
      await createVisitor.mutateAsync({
        unitId,
        name: fav.name,
        phone: fav.phone ?? undefined,
        vehiclePlate: fav.vehiclePlate ?? undefined,
        expectedAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      Alert.alert('Pass created', `${fav.name} can enter with the new access code.`);
    } catch (err) {
      Alert.alert('Could not create pass', (err as Error).message);
    }
  }

  async function onDelete(id: string) {
    if (!unitId) return;
    try {
      await deleteFav.mutateAsync({ id, unitId });
    } catch (err) {
      Alert.alert('Could not remove', (err as Error).message);
    }
  }

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title={showForm ? 'Cancel' : 'Add favourite'}
          size="sm"
          variant="secondary"
          onPress={() => setShowForm((v) => !v)}
        />
      </View>

      {showForm ? (
        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>New favourite</Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={inputStyle} />
          <TextInput
            placeholder="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            style={[inputStyle, { marginTop: 10 }]}
          />
          <TextInput
            placeholder="Plate (optional)"
            value={plate}
            onChangeText={setPlate}
            style={[inputStyle, { marginTop: 10 }]}
          />
          <View style={{ marginTop: 12 }}>
            <Button title="Save" loading={createFav.isPending} onPress={onSave} />
          </View>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No favourites yet"
          description="Save frequent guests for one-tap pre-registration."
        />
      ) : (
        items.map((fav) => (
          <Card key={fav.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{fav.name}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  {[fav.phone, fav.vehiclePlate].filter(Boolean).join(' · ') || 'No details'}
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                <Button
                  title="Quick pass"
                  size="sm"
                  loading={createVisitor.isPending}
                  onPress={() => onQuickPass(fav)}
                />
                <Button title="Remove" size="sm" variant="ghost" onPress={() => onDelete(fav.id)} />
              </View>
            </View>
          </Card>
        ))
      )}
    </>
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
