'use client';

import { api } from '@/lib/api';
import {
  useCondoVisitorSettings,
  useMyCondos,
  useUpdateCondoVisitorSettings,
} from '@smartresidence/api-client';
import type {
  CondoVisitorSettings,
  UpdateCondoVisitorSettingsInput,
} from '@smartresidence/shared-types';
import { VISITOR_PURPOSE_OPTIONS } from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Skeleton, Textarea } from '@smartresidence/ui-web';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export default function VisitorSettingsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const settingsQuery = useCondoVisitorSettings(api, condo?.id ?? null);
  const update = useUpdateCondoVisitorSettings(api);

  const [form, setForm] = useState<CondoVisitorSettings | null>(null);
  const [holidaysText, setHolidaysText] = useState('');

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data);
      setHolidaysText(settingsQuery.data.publicHolidays.join('\n'));
    }
  }, [settingsQuery.data]);

  function patch<K extends keyof CondoVisitorSettings>(key: K, value: CondoVisitorSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleWeekday(day: number) {
    if (!form) return;
    const weekdays = form.workingDays.weekdays.includes(day)
      ? form.workingDays.weekdays.filter((d) => d !== day)
      : [...form.workingDays.weekdays, day].sort((a, b) => a - b);
    patch('workingDays', { weekdays });
  }

  async function onSave() {
    if (!condo || !form) return;
    const holidays = holidaysText
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    const payload: UpdateCondoVisitorSettingsInput = {
      ...form,
      publicHolidays: holidays.length ? holidays : form.publicHolidays,
    };
    try {
      await update.mutateAsync({ condoId: condo.id, data: payload });
      toast.success('Visitor settings saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (settingsQuery.isLoading || !form) {
    return <Skeleton className="h-96 max-w-3xl" />;
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visitor settings</h1>
        <p className="sr-muted text-sm mt-1">
          Overnight caps, walk-in timeouts, holidays, and enforcement toggles for {condo?.name}.
        </p>
      </header>

      <Card className="p-6 flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthlyCap">Monthly overnight cap (per unit)</Label>
            <Input
              id="monthlyCap"
              type="number"
              min={1}
              value={form.maxOvernightVisitsPerUnitPerMonth}
              onChange={(e) =>
                patch('maxOvernightVisitsPerUnitPerMonth', Number(e.target.value) || 1)
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slots">Overnight slots per night (holidays)</Label>
            <Input
              id="slots"
              type="number"
              min={1}
              value={form.overnightSlotsPerNight}
              onChange={(e) => patch('overnightSlotsPerNight', Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkIn">Walk-in approval timeout (minutes)</Label>
            <Input
              id="walkIn"
              type="number"
              min={1}
              value={form.walkInApprovalMinutes}
              onChange={(e) => patch('walkInApprovalMinutes', Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buffer">Pre-reg expiry buffer (minutes)</Label>
            <Input
              id="buffer"
              type="number"
              min={0}
              value={form.preRegExpiryBufferMins}
              onChange={(e) => patch('preRegExpiryBufferMins', Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="urgent">Urgent overnight threshold (hours)</Label>
            <Input
              id="urgent"
              type="number"
              min={1}
              value={form.urgentOvernightMinHours}
              onChange={(e) => patch('urgentOvernightMinHours', Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultPurpose">Default purpose</Label>
            <select
              id="defaultPurpose"
              className="h-10 rounded-lg border border-[rgb(var(--sr-border))] bg-transparent px-3 text-sm"
              value={form.defaultPurpose}
              onChange={(e) =>
                patch('defaultPurpose', e.target.value as CondoVisitorSettings['defaultPurpose'])
              }
            >
              {VISITOR_PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <Label className="mb-2 block">Working days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((d) => {
              const active = form.workingDays.weekdays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    active
                      ? 'border-[rgb(var(--sr-primary))] bg-[rgb(var(--sr-primary)/0.1)]'
                      : 'border-[rgb(var(--sr-border))] hover:bg-[rgb(var(--sr-surface-elevated))]'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <Label htmlFor="holidays">Public holidays (YYYY-MM-DD, one per line)</Label>
          <Textarea
            id="holidays"
            rows={6}
            value={holidaysText}
            onChange={(e) => setHolidaysText(e.target.value)}
            placeholder="2026-01-01&#10;2026-05-01"
          />
        </section>

        <section className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--sr-border))] px-4 py-3">
            <div>
              <p className="text-sm font-medium">Count pending toward monthly cap</p>
              <p className="text-xs sr-muted">
                Includes PENDING_MANAGEMENT_APPROVAL in unit totals
              </p>
            </div>
            <input
              type="checkbox"
              className="size-5 accent-[rgb(var(--sr-primary))]"
              checked={form.countPendingTowardCap}
              onChange={(e) => patch('countPendingTowardCap', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--sr-border))] px-4 py-3">
            <div>
              <p className="text-sm font-medium">Require plate photo for overnight</p>
              <p className="text-xs sr-muted">
                Residents must upload a photo matching the typed plate
              </p>
            </div>
            <input
              type="checkbox"
              className="size-5 accent-[rgb(var(--sr-primary))]"
              checked={form.requirePlatePhotoOvernight}
              onChange={(e) => patch('requirePlatePhotoOvernight', e.target.checked)}
            />
          </label>
        </section>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={update.isPending}>
            <Save className="size-4 mr-2" />
            {update.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
