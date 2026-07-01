import {
  useCancelBooking,
  useCreateBooking,
  useFacilities,
  useFacilityAvailability,
  useMyBookings,
  useMyCondos,
  useMyUnits,
} from '@smartresidence/api-client';
import type {
  AvailabilitySlot,
  Booking,
  BookingStatus,
  Facility,
} from '@smartresidence/shared-types';
import { BOOKING_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  FadeInView,
  Pill,
  Skeleton,
  SkeletonList,
  palette,
  radius,
} from '@smartresidence/ui-mobile';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  RESIDENT_CORAL,
  RESIDENT_SOFT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticError, hapticSelection, hapticSuccess } from '../../src/lib/haptics';

type OwnedUnit = { id: string; identifier: string };

const STATUS_TONE: Record<BookingStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  COMPLETED: 'neutral',
};

function fmtMoney(n: number | null | undefined) {
  if (!n) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(n));
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function next7Days(): Array<{ iso: string; label: string }> {
  const out: Array<{ iso: string; label: string }> = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: isoDate(d),
      label:
        i === 0 ? 'Today' : d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric' }),
    });
  }
  return out;
}

export default function FacilitiesScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const facilitiesQuery = useFacilities(api, condo?.id ?? null);
  const myBookings = useMyBookings(api);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { refreshControl } = usePullToRefresh(
    useCallback(
      () => Promise.all([facilitiesQuery.refetch(), myBookings.refetch()]).then(() => undefined),
      [facilitiesQuery, myBookings],
    ),
  );

  const facilities = (facilitiesQuery.data ?? []) as Facility[];
  const selected = facilities.find((f) => f.id === selectedId) ?? null;

  return (
    <ResidentScreen
      eyebrow="Amenities"
      title="Facilities"
      subtitle="Book the function hall, BBQ pits, gym and more. Fees and deposits go through your billing account."
      scrollProps={{ refreshControl }}
      headerAction={
        selected ? (
          <Button
            title="← All facilities"
            size="sm"
            variant="secondary"
            onPress={() => setSelectedId(null)}
          />
        ) : undefined
      }
    >
      {selected ? (
        <BookingPanel facility={selected} />
      ) : facilitiesQuery.isLoading ? (
        <SkeletonList rows={3} rowHeight={72} />
      ) : facilities.length === 0 ? (
        <EmptyState
          title="No bookable facilities"
          description="Management has not published any facilities yet."
        />
      ) : (
        <>
          <ResidentSectionHeader title="Available to book" />
          {facilities.map((f, index) => (
            <FadeInView key={f.id} index={index}>
              <FacilityListItem facility={f} onSelect={() => setSelectedId(f.id)} />
            </FadeInView>
          ))}
        </>
      )}

      <ResidentSectionHeader title="My bookings" />
      <MyBookingsList />
    </ResidentScreen>
  );
}

function FacilityListItem({ facility, onSelect }: { facility: Facility; onSelect: () => void }) {
  const fee = fmtMoney(facility.bookingFee);
  const deposit = fmtMoney(facility.depositAmount);
  return (
    <AnimatedPressable onPress={onSelect}>
      <Card style={residentStyles.card}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                {facility.name}
              </AppText>
              {facility.requiresApproval ? <Pill tone="warning" label="Approval" /> : null}
            </View>
            <AppText variant="meta" style={{ color: palette.mutedLight }}>
              {facility.openTime}–{facility.closeTime}
              {fee ? ` · Fee ${fee}` : ''}
              {deposit ? ` · Deposit ${deposit}` : ''}
            </AppText>
          </View>
          <AppText style={{ color: palette.mutedLight, fontSize: 20 }}>›</AppText>
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function BookingPanel({ facility }: { facility: Facility }) {
  const days = useMemo(next7Days, []);
  const [date, setDate] = useState(days[0]?.iso ?? isoDate(new Date()));
  const [unitId, setUnitId] = useState('');
  const availability = useFacilityAvailability(api, facility.id, date);
  const createBooking = useCreateBooking(api);
  const units = useMyUnits(api);
  const requiresMoney = Boolean(facility.bookingFee || facility.depositAmount);

  const ownedUnits = useMemo<OwnedUnit[]>(() => {
    const rows = (units.data ?? []) as Array<{ id: string; identifier: string }>;
    return rows.map((u) => ({ id: u.id, identifier: u.identifier }));
  }, [units.data]);

  const effectiveUnitId = unitId || ownedUnits[0]?.id || '';
  const slots = (availability.data?.slots ?? []) as AvailabilitySlot[];

  const book = (slot: AvailabilitySlot) => {
    if (requiresMoney && !effectiveUnitId) {
      Alert.alert('Select a unit', 'This facility has a fee/deposit — pick which unit to bill.');
      return;
    }
    const label = `${fmtTime(slot.startAt)}–${fmtTime(slot.endAt)}`;
    Alert.alert('Confirm booking', `Book ${facility.name} for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Book',
        onPress: async () => {
          try {
            await createBooking.mutateAsync({
              facilityId: facility.id,
              unitId: requiresMoney ? effectiveUnitId : effectiveUnitId || undefined,
              startAt: new Date(slot.startAt),
              endAt: new Date(slot.endAt),
            });
            hapticSuccess();
            Alert.alert(
              'Booked',
              facility.requiresApproval
                ? 'Your booking is awaiting management approval.'
                : 'Your slot is confirmed.',
            );
            availability.refetch();
          } catch (err) {
            hapticError();
            Alert.alert('Could not book', (err as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 16 }}>
      <Card style={[residentStyles.card, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: palette.textLight }}>
            {facility.name}
          </AppText>
          {facility.requiresApproval ? <Pill tone="warning" label="Approval" /> : null}
        </View>
        {facility.description ? (
          <AppText variant="bodySm" style={{ color: palette.textLight }}>
            {facility.description}
          </AppText>
        ) : null}
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          {facility.openTime}–{facility.closeTime} · {facility.slotMinutes} min slots
          {fmtMoney(facility.bookingFee) ? ` · Fee ${fmtMoney(facility.bookingFee)}` : ''}
          {fmtMoney(facility.depositAmount)
            ? ` · Deposit ${fmtMoney(facility.depositAmount)} (refundable)`
            : ''}
        </AppText>
      </Card>

      <Card style={[residentStyles.card, { gap: 12 }]}>
        <AppText variant="label">Pick a day</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {days.map((d) => (
            <Chip
              key={d.iso}
              label={d.label}
              active={date === d.iso}
              onPress={() => {
                hapticSelection();
                setDate(d.iso);
              }}
            />
          ))}
        </View>

        {ownedUnits.length > 0 ? (
          <View style={{ gap: 6 }}>
            <AppText variant="label">Unit {requiresMoney ? '(required)' : '(optional)'}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ownedUnits.map((u) => (
                <Chip
                  key={u.id}
                  label={u.identifier}
                  active={effectiveUnitId === u.id}
                  onPress={() => {
                    hapticSelection();
                    setUnitId(u.id);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <AppText variant="label">Available slots</AppText>
        {availability.isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={`slot-skeleton-${i}`} width={92} height={54} radius={radius.lg} />
            ))}
          </View>
        ) : slots.length === 0 ? (
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            No slots configured for this day.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {slots.map((slot) => {
              const key = new Date(slot.startAt).toISOString();
              return (
                <AnimatedPressable
                  key={key}
                  disabled={!slot.available || createBooking.isPending}
                  onPress={() => book(slot)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: slot.available ? 'rgba(255, 56, 92, 0.25)' : palette.borderLight,
                    backgroundColor: slot.available ? RESIDENT_SOFT_CORAL : palette.surfaceLight,
                    opacity: slot.available ? 1 : 0.5,
                  }}
                >
                  <AppText
                    style={{
                      fontWeight: '700',
                      color: slot.available ? RESIDENT_CORAL : palette.mutedLight,
                    }}
                  >
                    {fmtTime(slot.startAt)}
                  </AppText>
                  <AppText variant="meta" style={{ color: palette.mutedLight }}>
                    {slot.available
                      ? facility.maxConcurrent > 1
                        ? `${slot.remaining} left`
                        : 'Free'
                      : 'Booked'}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </Card>
    </View>
  );
}

function MyBookingsList() {
  const bookings = useMyBookings(api);
  const cancelBooking = useCancelBooking(api);
  const items = (bookings.data?.items ?? []) as Booking[];

  const cancel = (b: Booking) => {
    Alert.alert('Cancel booking?', 'Any held deposit will be released back to you.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking.mutateAsync({ id: b.id });
            hapticSuccess();
          } catch (err) {
            hapticError();
            Alert.alert('Could not cancel', (err as Error).message);
          }
        },
      },
    ]);
  };

  if (bookings.isLoading) {
    return <SkeletonList rows={2} rowHeight={88} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState title="No bookings yet" description="Pick a facility above to reserve a slot." />
    );
  }

  return (
    <>
      {items.map((b, index) => {
        const cancellable = b.status === 'PENDING' || b.status === 'CONFIRMED';
        return (
          <FadeInView key={b.id} index={index}>
            <Card style={[residentStyles.card, { gap: 8 }]}>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
              >
                <AppText style={{ fontWeight: '700', color: palette.textLight }}>
                  {b.facility?.name ?? 'Facility'}
                </AppText>
                <Pill tone={STATUS_TONE[b.status]} label={BOOKING_STATUS_LABELS[b.status]} />
              </View>
              <AppText variant="meta" style={{ color: palette.mutedLight }}>
                {fmtDateTime(b.startAt)}–{fmtTime(b.endAt)}
                {b.fee ? ` · Fee ${fmtMoney(b.fee)}` : ''}
                {b.depositHeld ? ` · Deposit ${fmtMoney(b.depositHeld)}` : ''}
              </AppText>
              {cancellable ? (
                <Button
                  title="Cancel booking"
                  size="sm"
                  variant="secondary"
                  onPress={() => cancel(b)}
                />
              ) : null}
            </Card>
          </FadeInView>
        );
      })}
    </>
  );
}
