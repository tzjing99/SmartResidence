'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useApproveBooking,
  useCancelBooking,
  useCondoBookings,
  useCreateFacility,
  useDeleteFacility,
  useFacilities,
  useMyCondos,
  useRejectBooking,
  useUpdateFacility,
} from '@smartresidence/api-client';
import type { Booking, BookingStatus, Facility } from '@smartresidence/shared-types';
import { BOOKING_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

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

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type FormState = {
  name: string;
  description: string;
  capacity: string;
  requiresApproval: boolean;
  bookingFee: string;
  depositAmount: string;
  openTime: string;
  closeTime: string;
  slotMinutes: string;
  maxConcurrent: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  capacity: '',
  requiresApproval: false,
  bookingFee: '',
  depositAmount: '',
  openTime: '08:00',
  closeTime: '22:00',
  slotMinutes: '60',
  maxConcurrent: '1',
  active: true,
};

function facilityToForm(f: Facility): FormState {
  return {
    name: f.name,
    description: f.description ?? '',
    capacity: f.capacity ? String(f.capacity) : '',
    requiresApproval: f.requiresApproval,
    bookingFee: f.bookingFee ? String(f.bookingFee) : '',
    depositAmount: f.depositAmount ? String(f.depositAmount) : '',
    openTime: f.openTime,
    closeTime: f.closeTime,
    slotMinutes: String(f.slotMinutes),
    maxConcurrent: String(f.maxConcurrent),
    active: f.active,
  };
}

function FacilityForm({
  condoId,
  editing,
  onDone,
}: {
  condoId: string;
  editing: Facility | null;
  onDone: () => void;
}) {
  const createFacility = useCreateFacility(api);
  const updateFacility = useUpdateFacility(api);
  const [form, setForm] = React.useState<FormState>(editing ? facilityToForm(editing) : emptyForm);
  const pending = createFacility.isPending || updateFacility.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      requiresApproval: form.requiresApproval,
      bookingFee: form.bookingFee ? Number(form.bookingFee) : undefined,
      depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
      openTime: form.openTime,
      closeTime: form.closeTime,
      slotMinutes: Number(form.slotMinutes),
      maxConcurrent: Number(form.maxConcurrent),
      active: form.active,
    };
    try {
      if (editing) {
        await updateFacility.mutateAsync({ id: editing.id, data: payload });
        toast.success('Facility updated');
      } else {
        await createFacility.mutateAsync({ condoId, ...payload });
        toast.success('Facility created');
      }
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="fac-name">Name</Label>
          <Input
            id="fac-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Function Hall, BBQ Pit A, Surau"
            required
            minLength={2}
          />
        </div>
        <div>
          <Label htmlFor="fac-desc">Description (optional)</Label>
          <Input
            id="fac-desc"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="House rules, capacity notes…"
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="fac-open">Opens</Label>
            <Input
              id="fac-open"
              type="time"
              value={form.openTime}
              onChange={(e) => set('openTime', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fac-close">Closes</Label>
            <Input
              id="fac-close"
              type="time"
              value={form.closeTime}
              onChange={(e) => set('closeTime', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fac-slot">Slot length (min)</Label>
            <Input
              id="fac-slot"
              type="number"
              min={15}
              step={15}
              value={form.slotMinutes}
              onChange={(e) => set('slotMinutes', e.target.value)}
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="fac-cap">Capacity (optional)</Label>
            <Input
              id="fac-cap"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fac-max">Concurrent bookings</Label>
            <Input
              id="fac-max"
              type="number"
              min={1}
              value={form.maxConcurrent}
              onChange={(e) => set('maxConcurrent', e.target.value)}
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fac-fee">Booking fee RM (optional)</Label>
            <Input
              id="fac-fee"
              type="number"
              min={0}
              step="0.01"
              value={form.bookingFee}
              onChange={(e) => set('bookingFee', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fac-dep">Refundable deposit RM (optional)</Label>
            <Input
              id="fac-dep"
              type="number"
              min={0}
              step="0.01"
              value={form.depositAmount}
              onChange={(e) => set('depositAmount', e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => set('requiresApproval', e.target.checked)}
            />
            Require management approval
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            Active (bookable)
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
            {editing ? 'Save changes' : 'Create facility'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BookingsList({ condoId }: { condoId: string }) {
  const [tab, setTab] = React.useState<'PENDING' | 'upcoming'>('PENDING');
  const bookings = useCondoBookings(
    api,
    condoId,
    tab === 'PENDING' ? { status: 'PENDING' } : { upcoming: true },
  );
  const approve = useApproveBooking(api);
  const reject = useRejectBooking(api);
  const cancel = useCancelBooking(api);
  const items = (bookings.data?.items ?? []) as Booking[];

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={tab === 'PENDING' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setTab('PENDING')}
        >
          Awaiting approval
        </Button>
        <Button
          variant={tab === 'upcoming' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setTab('upcoming')}
        >
          Upcoming
        </Button>
      </div>
      {bookings.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm sr-muted">Nothing here right now.</p>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgb(var(--sr-border))] p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{b.facility?.name ?? 'Facility'}</span>
                  <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                </div>
                <p className="text-sm sr-muted mt-0.5">
                  {fmtDateTime(b.startAt)} · {b.user?.name ?? 'Resident'}
                  {b.unit?.identifier ? ` · ${b.unit.identifier}` : ''}
                  {b.fee ? ` · Fee ${fmtMoney(b.fee)}` : ''}
                  {b.depositHeld ? ` · Deposit ${fmtMoney(b.depositHeld)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {b.status === 'PENDING' ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => act(() => approve.mutateAsync(b.id), 'Booking approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (window.confirm('Reject this booking request?')) {
                          act(() => reject.mutateAsync({ id: b.id }), 'Booking rejected');
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </>
                ) : b.status === 'CONFIRMED' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Cancel this confirmed booking? Any held deposit is released.',
                        )
                      ) {
                        act(() => cancel.mutateAsync({ id: b.id }), 'Booking cancelled');
                      }
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminFacilitiesPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const facilities = useFacilities(api, condo?.id ?? null, { includeInactive: true });
  const deleteFacility = useDeleteFacility(api);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Facility | null>(null);

  const items = (facilities.data ?? []) as Facility[];

  const remove = async (f: Facility) => {
    if (
      !window.confirm(
        `Delete or disable "${f.name}"? Facilities with future bookings are disabled instead.`,
      )
    ) {
      return;
    }
    try {
      await deleteFacility.mutateAsync(f.id);
      toast.success('Facility removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-6 text-[rgb(var(--sr-coral))]" />
            Facilities & bookings
          </h1>
          <p className="text-sm sr-muted mt-1">
            Configure bookable amenities and review resident bookings.
          </p>
        </div>
        {!showForm ? (
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-4 mr-1.5" />
            New facility
          </Button>
        ) : null}
      </div>

      {showForm && condo?.id ? (
        <FacilityForm
          condoId={condo.id}
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      {facilities.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('admin.facilities.emptyTitle')}
          description="Add your first bookable amenity — e.g. Function Hall or BBQ Pit A."
        />
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    {!f.active ? <Badge tone="neutral">Inactive</Badge> : null}
                    {f.requiresApproval ? <Badge tone="warning">Approval</Badge> : null}
                  </div>
                  <p className="text-sm sr-muted mt-0.5">
                    {f.openTime}–{f.closeTime} · {f.slotMinutes} min · {f.maxConcurrent}x concurrent
                    {fmtMoney(f.bookingFee) ? ` · Fee ${fmtMoney(f.bookingFee)}` : ''}
                    {fmtMoney(f.depositAmount) ? ` · Deposit ${fmtMoney(f.depositAmount)}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(f);
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(f)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {condo?.id ? <BookingsList condoId={condo.id} /> : null}
    </div>
  );
}
