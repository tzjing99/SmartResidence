'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCreateRecurringPass,
  useDeleteRecurringPass,
  useUnitRecurringPasses,
  useUpdateRecurringPass,
} from '@smartresidence/api-client';
import type { RecurringPass } from '@smartresidence/shared-types';
import { formatRecurringScheduleSummary } from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label } from '@smartresidence/ui-web';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function RecurringPassesPanel({ unitId }: { unitId?: string }) {
  const t = useT();
  const list = useUnitRecurringPasses(api, unitId ?? null);
  const create = useCreateRecurringPass(api);
  const update = useUpdateRecurringPass(api);
  const remove = useDeleteRecurringPass(api);

  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('18:00');
  const [validFrom, setValidFrom] = useState(toDateInput(new Date()));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return toDateInput(d);
  });
  const [busy, setBusy] = useState(false);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !guestName.trim()) return;
    if (days.length === 0) {
      toast.error(t('visitors.recurring.weekdayRequiredToast'));
      return;
    }
    setBusy(true);
    try {
      await create.mutateAsync({
        unitId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        schedule: { daysOfWeek: days, timeWindow: { start: timeStart, end: timeEnd } },
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
      });
      setShowForm(false);
      setGuestName('');
      setGuestPhone('');
      setVehiclePlate('');
      toast.success(t('visitors.recurring.createdToast'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(pass: RecurringPass) {
    if (!unitId) return;
    try {
      await update.mutateAsync({ id: pass.id, unitId, data: { active: !pass.active } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onRemove(pass: RecurringPass) {
    if (!unitId) return;
    if (!window.confirm('Delete this recurring pass?')) return;
    try {
      await remove.mutateAsync({ id: pass.id, unitId });
      toast.success(t('visitors.recurring.deletedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const items = (list.data?.items ?? []) as RecurringPass[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm sr-muted">
          Weekly passes for regular guests (e.g. cleaners, tutors). Share the access code at the
          gate — guards check in without a full walk-in.
        </p>
        <Button type="button" onClick={() => setShowForm((v) => !v)} disabled={!unitId}>
          <Plus className="size-4" />
          New weekly pass
        </Button>
      </div>

      {showForm ? (
        <Card className="flex flex-col gap-4 p-4">
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="rp-name">Guest name</Label>
              <Input
                id="rp-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                placeholder="e.g. Puan Siti (cleaner)"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-phone">Phone (optional)</Label>
              <Input
                id="rp-phone"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+60…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-plate">Plate (optional)</Label>
              <Input
                id="rp-plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      days.includes(d.value)
                        ? 'border-coral-500 bg-coral-500/10 text-coral-600'
                        : 'border-[rgb(var(--sr-border))] sr-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-start">From</Label>
              <Input
                id="rp-start"
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-end">Until</Label>
              <Input
                id="rp-end"
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-vf">Valid from</Label>
              <Input
                id="rp-vf"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-vu">Valid until</Label>
              <Input
                id="rp-vu"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create pass'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {list.isLoading ? (
        <p className="text-sm sr-muted">Loading recurring passes…</p>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center">
          <CalendarDays className="size-8 mx-auto sr-muted mb-2" />
          <p className="text-sm sr-muted">No recurring passes yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((pass) => (
            <Card key={pass.id} className="p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{pass.guestName}</p>
                  <p className="text-sm sr-muted">
                    {formatRecurringScheduleSummary(pass.schedule)}
                  </p>
                  {pass.accessCode ? (
                    <p className="font-mono text-lg font-bold tracking-widest mt-2">
                      {pass.accessCode}
                    </p>
                  ) : null}
                </div>
                <Badge tone={pass.active ? 'success' : 'neutral'}>
                  {pass.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleActive(pass)}
                >
                  {pass.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(pass)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
