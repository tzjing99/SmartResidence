'use client';

import { useT } from '@/i18n/locale-provider';
import { toastResidentMutationError } from '@/lib/access-restriction-error';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
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
import { Badge, Button, Card, EmptyState, Label, Skeleton } from '@smartresidence/ui-web';
import { CalendarDays, ChevronRight, Clock, Users, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const STATUS_TONE: Record<BookingStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  COMPLETED: 'neutral',
};

const selectCls = 'sr-select';

function fmtMoney(n: number | null | undefined) {
  if (!n) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(n));
}

function todayIso() {
  const d = new Date();
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

type OwnedUnit = { id: string; identifier: string };

function useOwnedUnits(): OwnedUnit[] {
  const units = useMyUnits(api);
  return React.useMemo(() => {
    const rows = (units.data ?? []) as Array<{
      id: string;
      identifier: string;
    }>;
    return rows.map((u) => ({ id: u.id, identifier: u.identifier }));
  }, [units.data]);
}

function BookingPanel({ facility, units }: { facility: Facility; units: OwnedUnit[] }) {
  const t = useT();
  const router = useRouter();
  const [date, setDate] = React.useState(todayIso());
  const [unitId, setUnitId] = React.useState('');
  const availability = useFacilityAvailability(api, facility.id, date);
  const createBooking = useCreateBooking(api);
  const requiresMoney = Boolean(facility.bookingFee || facility.depositAmount);

  React.useEffect(() => {
    if (!unitId && units[0]) setUnitId(units[0].id);
  }, [units, unitId]);

  const book = async (slot: AvailabilitySlot) => {
    if (requiresMoney && !unitId) {
      toast.error('Select the unit this booking is for');
      return;
    }
    const label = `${fmtTime(slot.startAt)}–${fmtTime(slot.endAt)}`;
    if (!window.confirm(`Book ${facility.name} for ${label} on ${date}?`)) return;
    try {
      await createBooking.mutateAsync({
        facilityId: facility.id,
        unitId: requiresMoney ? unitId : unitId || undefined,
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
      });
      toast.success(
        facility.requiresApproval
          ? 'Booking requested — awaiting management approval'
          : 'Slot booked. See "My bookings" below.',
      );
      availability.refetch();
    } catch (err) {
      toastResidentMutationError(err, {
        arrearsTitle: t('billing.accessRestrictedTitle'),
        arrearsBody: t('billing.accessRestrictedBody'),
        payLabel: t('billing.accessRestrictedPay'),
        onPay: () => router.push('/billing'),
      });
    }
  };

  const slots = availability.data?.slots ?? [];

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{facility.name}</h2>
        {facility.requiresApproval ? <Badge tone="warning">Approval required</Badge> : null}
      </div>
      {facility.description ? <p className="text-sm sr-muted">{facility.description}</p> : null}
      <div className="flex flex-wrap gap-4 text-sm sr-muted">
        {facility.capacity ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" /> Up to {facility.capacity}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Clock className="size-4" /> {facility.openTime}–{facility.closeTime} ·{' '}
          {facility.slotMinutes} min slots
        </span>
        {fmtMoney(facility.bookingFee) ? (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-4" /> Fee {fmtMoney(facility.bookingFee)}
          </span>
        ) : null}
        {fmtMoney(facility.depositAmount) ? (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-4" /> Deposit {fmtMoney(facility.depositAmount)} (refundable)
          </span>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="book-date">Date</Label>
          <input
            id="book-date"
            type="date"
            className={selectCls}
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {units.length > 0 ? (
          <div>
            <Label htmlFor="book-unit">
              Unit {requiresMoney ? '(required for fee/deposit)' : '(optional)'}
            </Label>
            <select
              id="book-unit"
              className={selectCls}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">No unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.identifier}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Available slots</p>
        {availability.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : slots.length === 0 ? (
          <p className="text-sm sr-muted">No slots configured for this day.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slots.map((slot) => {
              const key = new Date(slot.startAt).toISOString();
              const disabled = !slot.available || createBooking.isPending;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => book(slot)}
                  className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                    slot.available
                      ? 'border-[rgb(var(--sr-border))] hover:border-[rgb(var(--sr-coral)/0.5)] hover:bg-[rgb(var(--sr-coral)/0.05)]'
                      : 'border-[rgb(var(--sr-border))] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="font-medium">{fmtTime(slot.startAt)}</div>
                  <div className="sr-muted text-xs">
                    {slot.available
                      ? facility.maxConcurrent > 1
                        ? `${slot.remaining} left`
                        : 'Free'
                      : 'Booked'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function MyBookings() {
  const bookings = useMyBookings(api);
  const cancelBooking = useCancelBooking(api);
  const items = (bookings.data?.items ?? []) as Booking[];

  const cancel = async (b: Booking) => {
    if (!window.confirm('Cancel this booking? Any held deposit is released.')) return;
    try {
      await cancelBooking.mutateAsync({ id: b.id });
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (bookings.isLoading) return <Skeleton className="h-24 w-full" />;
  if (items.length === 0) {
    return (
      <EmptyState title="No bookings yet" description="Pick a facility above to reserve a slot." />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((b) => {
        const cancellable = b.status === 'PENDING' || b.status === 'CONFIRMED';
        return (
          <Card key={b.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{b.facility?.name ?? 'Facility'}</span>
                  <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                </div>
                <p className="text-sm sr-muted mt-0.5">
                  {fmtDateTime(b.startAt)}–{fmtTime(b.endAt)}
                  {b.fee ? ` · Fee ${fmtMoney(b.fee)}` : ''}
                  {b.depositHeld ? ` · Deposit ${fmtMoney(b.depositHeld)}` : ''}
                </p>
              </div>
              {cancellable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancel(b)}
                  disabled={cancelBooking.isPending}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function ResidentFacilitiesPage() {
  useRoleGuard('resident');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const facilities = useFacilities(api, condo?.id ?? null);
  const units = useOwnedUnits();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const items = (facilities.data ?? []) as Facility[];
  const selected = items.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="size-6 text-[rgb(var(--sr-coral))]" />
          Facilities
        </h1>
        <p className="text-sm sr-muted mt-1">
          Book shared amenities — function hall, BBQ pits, gym, and more. Fees and refundable
          deposits are handled through your billing account.
        </p>
      </div>

      {facilities.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No bookable facilities"
          description="Management has not published any facilities for booking yet."
        />
      ) : selected ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            ← Back to facilities
          </Button>
          <BookingPanel facility={selected} units={units} />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className="w-full text-left"
            >
              <Card className="p-4 hover:border-[rgb(var(--sr-coral)/0.4)] transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {f.requiresApproval ? <Badge tone="warning">Approval</Badge> : null}
                    </div>
                    <p className="text-sm sr-muted mt-0.5">
                      {f.openTime}–{f.closeTime}
                      {fmtMoney(f.bookingFee) ? ` · Fee ${fmtMoney(f.bookingFee)}` : ''}
                      {fmtMoney(f.depositAmount) ? ` · Deposit ${fmtMoney(f.depositAmount)}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 sr-muted" />
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide sr-muted mb-2">My bookings</h2>
        <MyBookings />
      </section>
    </div>
  );
}
