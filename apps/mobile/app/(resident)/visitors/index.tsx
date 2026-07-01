import {
  useApproveVisitor,
  useCancelVisitor,
  useCreateFavouriteVisitor,
  useCreateVisitor,
  useDeleteFavouriteVisitor,
  useFavouriteVisitors,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import type { FavouriteVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import {
  canOneClickPreRegFromVisitor,
  canOwnerCancelVisitor,
  defaultExpectedArrival,
  deliveryPlatformLabel,
  favouriteToPreRegParams,
  formatMalaysiaPhoneDisplay,
  isQuickEntryPass,
  passKindLabel,
  visitorStatusLabel,
  visitorToCreateInput,
  visitorToPreRegParams,
} from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { DeliveryPassForm } from '../../../src/components/delivery-pass-form';
import {
  RESIDENT_CARD_BORDER,
  RESIDENT_SOFT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { api } from '../../../src/lib/api';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

type VisitorTab = VisitorListView | 'favourites';

function liveTabLabel(count: number): string {
  return count > 0 ? `On site now (${count})` : 'On site now';
}

export default function VisitorsScreen() {
  const router = useRouter();
  const { twoColumn } = useTabletLayout();
  const [tab, setTab] = useState<VisitorTab>('upcoming');
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const liveVisitors = useUnitVisitors(api, unit?.id ?? null, 'live');
  const liveCount = liveVisitors.data?.total ?? 0;
  const tabs = useMemo<{ id: VisitorTab; label: string }[]>(
    () => [
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'live', label: liveTabLabel(liveCount) },
      { id: 'history', label: 'History' },
      { id: 'favourites', label: 'Favourites' },
    ],
    [liveCount],
  );
  const listView: VisitorListView | undefined =
    tab === 'upcoming' || tab === 'history' || tab === 'live' ? tab : undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null, listView);
  const favourites = useFavouriteVisitors(api, tab === 'favourites' ? (unit?.id ?? null) : null);
  const listLoading = units.isPending || visitors.isLoading;
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () =>
        Promise.all([
          units.refetch(),
          liveVisitors.refetch(),
          tab === 'favourites' ? favourites.refetch() : visitors.refetch(),
        ]),
      [favourites, liveVisitors, tab, units, visitors],
    ),
  );
  const handlePreRegisterFavourite = useCallback(
    (fav: FavouriteVisitor) => {
      if (!fav.phone?.trim()) {
        Alert.alert('Phone required', 'Add a phone number to this favourite for quick passes.');
        return;
      }
      const qs = new URLSearchParams(favouriteToPreRegParams(fav)).toString();
      router.push(`/(resident)/visitors/new?${qs}` as Href);
    },
    [router],
  );

  return (
    <ResidentScreen
      eyebrow="Visitors"
      title="Guest access"
      subtitle="Pre-register guests for a fast gate pass, or track walk-ins waiting for approval."
      scrollProps={{ refreshControl }}
      headerAction={
        <View style={{ gap: 8 }}>
          <Button
            title="Pre-register a visitor"
            size="lg"
            onPress={() => router.push('/(resident)/visitors/new' as Href)}
          />
          <Button
            title="Recurring passes"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/(resident)/visitors/recurring' as Href)}
          />
        </View>
      }
    >
      <Card style={[residentStyles.card, { padding: 8 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radius.full,
                  backgroundColor: active ? RESIDENT_SOFT_CORAL : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? 'rgba(255, 56, 92, 0.25)' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: active ? palette.coralPrimary : palette.mutedLight,
                  }}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <DeliveryPassForm unitId={unit?.id} />

      {tab === 'favourites' ? (
        <FavouritesTab
          unitId={unit?.id}
          items={(favourites.data?.items ?? []) as FavouriteVisitor[]}
          onPreRegister={handlePreRegisterFavourite}
        />
      ) : (
        <VisitorsTab
          tab={tab}
          unitId={unit?.id}
          items={(visitors.data?.items ?? []) as Visitor[]}
          isLoading={listLoading}
          twoColumn={twoColumn}
        />
      )}
    </ResidentScreen>
  );
}

function VisitorsTab({
  tab,
  unitId,
  items,
  isLoading,
  twoColumn,
}: {
  tab: VisitorListView;
  unitId?: string;
  items: Visitor[];
  isLoading: boolean;
  twoColumn?: boolean;
}) {
  const router = useRouter();
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);
  const create = useCreateVisitor(api);
  const cancelPass = useCancelVisitor(api);
  const [inviteAgainVisitor, setInviteAgainVisitor] = useState<Visitor | null>(null);
  const [inviteExpectedAt, setInviteExpectedAt] = useState<Date>(() => defaultExpectedArrival());

  function openInviteAgain(v: Visitor) {
    if (!canOneClickPreRegFromVisitor(v)) {
      const qs = new URLSearchParams(visitorToPreRegParams(v)).toString();
      router.push(`/(resident)/visitors/new?${qs}` as Href);
      return;
    }
    setInviteExpectedAt(defaultExpectedArrival());
    setInviteAgainVisitor(v);
  }

  async function confirmInviteAgain() {
    if (!unitId || !inviteAgainVisitor) return;
    try {
      const created = await create.mutateAsync(
        visitorToCreateInput(inviteAgainVisitor, unitId, inviteExpectedAt),
      );
      setInviteAgainVisitor(null);
      router.push(`/(resident)/visitors/${created.id}` as Href);
    } catch (err) {
      Alert.alert('Could not invite again', (err as Error).message);
      const qs = new URLSearchParams(visitorToPreRegParams(inviteAgainVisitor)).toString();
      setInviteAgainVisitor(null);
      router.push(`/(resident)/visitors/new?${qs}` as Href);
    }
  }

  function promptCancelPass(v: Visitor) {
    Alert.alert(
      'Cancel this visitor pass?',
      'The access code will stop working immediately. Your guest will not be able to check in.',
      [
        { text: 'Keep pass', style: 'cancel' },
        {
          text: 'Cancel pass',
          style: 'destructive',
          onPress: () => {
            if (!unitId) return;
            void cancelPass
              .mutateAsync({ visitorId: v.id, unitId })
              .catch((err) => Alert.alert('Could not cancel', (err as Error).message));
          },
        },
      ],
    );
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

  if (isLoading) {
    return (
      <Card style={residentStyles.card}>
        <Text style={{ color: palette.mutedLight, fontSize: 14 }}>Loading visitors…</Text>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={
          tab === 'upcoming'
            ? 'No upcoming visitors'
            : tab === 'live'
              ? 'No one on site'
              : 'No visit history yet'
        }
        description={
          tab === 'upcoming'
            ? 'Pre-registered visitors and pending walk-ins show up here.'
            : tab === 'live'
              ? 'When a guest checks in at the gate, they appear here until they leave.'
              : 'Past check-ins and expired passes appear here.'
        }
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((v) => (
        <View
          key={v.id}
          style={{
            width: twoColumn ? '48%' : '100%',
            flexGrow: 1,
            minWidth: twoColumn ? 280 : undefined,
          }}
        >
          <Pressable
            onPress={() => {
              if (tab === 'upcoming' && v.visitType === 'PRE_REG' && v.status === 'APPROVED') {
                router.push(`/(resident)/visitors/${v.id}` as Href);
              }
            }}
            disabled={!(tab === 'upcoming' && v.visitType === 'PRE_REG' && v.status === 'APPROVED')}
          >
            <Card style={residentStyles.card}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontWeight: '700', color: palette.textLight, fontSize: 16 }}
                    numberOfLines={2}
                  >
                    {v.name}
                  </Text>
                  {isQuickEntryPass(v) ? (
                    <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                      <Pill
                        tone="warning"
                        label={
                          v.deliveryPlatform
                            ? deliveryPlatformLabel(v.deliveryPlatform)
                            : passKindLabel(v.passKind ?? 'DELIVERY')
                        }
                      />
                    </View>
                  ) : null}
                  <Text
                    style={{
                      color: palette.mutedLight,
                      fontSize: 12,
                      marginTop: 2,
                      lineHeight: 18,
                    }}
                    numberOfLines={2}
                  >
                    {tab === 'live'
                      ? 'On site now'
                      : tab === 'history' && v.status === 'CHECKED_OUT'
                        ? 'Visited'
                        : new Date(v.expectedAt).toLocaleString()}
                  </Text>
                  {v.accessCode && tab === 'upcoming' ? (
                    <Text
                      style={{ fontSize: 20, fontWeight: '700', letterSpacing: 2, marginTop: 8 }}
                      numberOfLines={1}
                    >
                      {v.accessCode}
                    </Text>
                  ) : null}
                  {tab === 'upcoming' && v.visitType === 'PRE_REG' && v.status === 'APPROVED' ? (
                    <Text
                      style={{
                        fontSize: 13,
                        color: palette.coralPrimary,
                        fontWeight: '600',
                        marginTop: 6,
                      }}
                    >
                      View pass →
                    </Text>
                  ) : null}
                  <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Pill
                      tone={
                        v.status === 'CHECKED_IN'
                          ? 'success'
                          : v.status === 'PENDING_OWNER_APPROVAL' ||
                              v.status === 'PENDING_MANAGEMENT_APPROVAL'
                            ? 'warning'
                            : v.status === 'CANCELLED' ||
                                v.status === 'REJECTED' ||
                                v.status === 'EXPIRED'
                              ? 'danger'
                              : 'primary'
                      }
                      label={visitorStatusLabel(v.status)}
                    />
                    {v.urgentOvernight ? <Pill tone="warning" label="Urgent" /> : null}
                  </View>
                  {v.status === 'PENDING_OWNER_APPROVAL' ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      <Button
                        title="Approve"
                        size="sm"
                        style={{ flexGrow: 1 }}
                        onPress={() => onApprove(v.id)}
                      />
                      <Button
                        title="Reject"
                        size="sm"
                        variant="secondary"
                        style={{ flexGrow: 1 }}
                        onPress={() => onReject(v.id)}
                      />
                    </View>
                  ) : null}
                  {tab === 'upcoming' && canOwnerCancelVisitor(v) ? (
                    <View style={{ marginTop: 12 }}>
                      <Button
                        title="Cancel pass"
                        size="sm"
                        variant="secondary"
                        onPress={() => promptCancelPass(v)}
                      />
                    </View>
                  ) : null}
                  {tab === 'history' &&
                  (v.status === 'CHECKED_OUT' || v.visitType === 'PRE_REG') ? (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: palette.borderLight,
                      }}
                    >
                      <Button
                        title="Invite again"
                        size="sm"
                        variant="soft-sky"
                        style={{ width: '100%' }}
                        onPress={() => openInviteAgain(v)}
                      />
                    </View>
                  ) : null}
                </View>
                {tab === 'upcoming' && (v.qrPayload || v.qrCode) ? (
                  <View
                    style={{
                      borderRadius: radius.md,
                      padding: 6,
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: RESIDENT_CARD_BORDER,
                    }}
                  >
                    <QRCode value={v.qrPayload ?? v.qrCode ?? ''} size={80} />
                  </View>
                ) : null}
              </View>
            </Card>
          </Pressable>
        </View>
      ))}

      <Modal
        visible={inviteAgainVisitor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteAgainVisitor(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setInviteAgainVisitor(null)}
        >
          <Pressable
            style={{
              backgroundColor: '#fff',
              borderRadius: radius.xl,
              padding: 20,
              gap: 16,
              borderWidth: 1,
              borderColor: RESIDENT_CARD_BORDER,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.textLight }}>
              Invite this visitor again?
            </Text>
            {inviteAgainVisitor ? (
              <Text style={{ color: palette.mutedLight, fontSize: 14, lineHeight: 20 }}>
                {inviteAgainVisitor.name}
                {(() => {
                  const phone = formatMalaysiaPhoneDisplay(
                    inviteAgainVisitor.phone,
                    inviteAgainVisitor.phoneCountryCode,
                  );
                  return phone ? ` · ${phone}` : '';
                })()}
              </Text>
            ) : null}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>Which visit session?</Text>
              <TextInput
                value={
                  inviteExpectedAt instanceof Date && !Number.isNaN(inviteExpectedAt.getTime())
                    ? inviteExpectedAt.toISOString().slice(0, 16).replace('T', ' ')
                    : ''
                }
                onChangeText={(v) => {
                  const parsed = new Date(v.replace(' ', 'T'));
                  if (!Number.isNaN(parsed.getTime())) setInviteExpectedAt(parsed);
                }}
                style={inputStyle}
                placeholder="YYYY-MM-DD HH:mm"
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                title="Cancel"
                size="sm"
                variant="secondary"
                onPress={() => setInviteAgainVisitor(null)}
              />
              <Button
                title="Send invite"
                size="sm"
                loading={create.isPending}
                onPress={() => void confirmInviteAgain()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FavouritesTab({
  unitId,
  items,
  onPreRegister,
}: {
  unitId?: string;
  items: FavouriteVisitor[];
  onPreRegister: (fav: FavouriteVisitor) => void;
}) {
  const createFav = useCreateFavouriteVisitor(api);
  const deleteFav = useDeleteFavouriteVisitor(api);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');

  async function onSave() {
    if (!unitId || !name.trim() || !phone.trim()) return;
    try {
      await createFav.mutateAsync({
        unitId,
        name: name.trim(),
        phoneCountryCode: '+60',
        phone: phone.trim(),
        vehiclePlate: plate.trim() || undefined,
        entryMode: plate.trim() ? 'DRIVE_IN' : 'WALK_IN',
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
      <ResidentSectionHeader
        title="Favourite guests"
        subtitle="Save frequent visitors so the next pass takes less time."
      />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title={showForm ? 'Cancel' : 'Add favourite'}
          size="sm"
          variant="secondary"
          onPress={() => setShowForm((v) => !v)}
        />
      </View>

      {showForm ? (
        <Card style={[residentStyles.card, { gap: 10 }]}>
          <Text style={{ fontWeight: '700', color: palette.textLight }}>New favourite</Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={inputStyle} />
          <TextInput
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            style={[inputStyle, { marginTop: 10 }]}
            keyboardType="phone-pad"
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
          description="Save frequent guests for quick pre-registration."
        />
      ) : (
        items.map((fav) => (
          <Card key={fav.id} style={residentStyles.card}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontWeight: '700', color: palette.textLight, fontSize: 16 }}
                  numberOfLines={2}
                >
                  {fav.name}
                </Text>
                <Text
                  style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2, lineHeight: 18 }}
                  numberOfLines={2}
                >
                  {[formatMalaysiaPhoneDisplay(fav.phone, fav.phoneCountryCode), fav.vehiclePlate]
                    .filter(Boolean)
                    .join(' · ') || 'No details'}
                </Text>
                {fav.entryMode ? (
                  <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                    <Pill tone="neutral" label={prettyLabel(fav.entryMode)} />
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 8, minWidth: 132, flexGrow: 1 }}>
                <Button title="Pre-register" size="sm" onPress={() => onPreRegister(fav)} />
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
  minHeight: 46,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  backgroundColor: palette.surfaceLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
