'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCondoVisitorSettings,
  useMyCondos,
  useUpdateCondoVisitorSettings,
} from '@smartresidence/api-client';
import type {
  CondoVisitorSettings,
  ResolvedHoliday,
  UpdateCondoVisitorSettingsInput,
} from '@smartresidence/shared-types';
import { MY_STATE_OPTIONS, VISITOR_PURPOSE_OPTIONS } from '@smartresidence/shared-types';
import { Button, Card, Select, Skeleton } from '@smartresidence/ui-web';
import {
  CalendarDays,
  CalendarPlus,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const PURPOSE_SELECT_OPTIONS = VISITOR_PURPOSE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fields that the admin can actually edit (drives the dirty-state comparison). */
type EditableSettings = Pick<
  CondoVisitorSettings,
  | 'maxOvernightVisitsPerUnitPerMonth'
  | 'overnightSlotsPerNight'
  | 'walkInApprovalMinutes'
  | 'walkInRequireOwnerApproval'
  | 'preRegExpiryBufferMins'
  | 'urgentOvernightMinHours'
  | 'workingDays'
  | 'holidayAuto'
  | 'holidayState'
  | 'customHolidays'
  | 'holidayExclusions'
  | 'holidayOvernightAutoApprove'
  | 'countPendingTowardCap'
  | 'requirePlatePhotoOvernight'
  | 'defaultPurpose'
>;

function toEditable(s: CondoVisitorSettings): EditableSettings {
  return {
    maxOvernightVisitsPerUnitPerMonth: s.maxOvernightVisitsPerUnitPerMonth,
    overnightSlotsPerNight: s.overnightSlotsPerNight,
    walkInApprovalMinutes: s.walkInApprovalMinutes,
    walkInRequireOwnerApproval: s.walkInRequireOwnerApproval,
    preRegExpiryBufferMins: s.preRegExpiryBufferMins,
    urgentOvernightMinHours: s.urgentOvernightMinHours,
    workingDays: { weekdays: [...s.workingDays.weekdays].sort((a, b) => a - b) },
    holidayAuto: s.holidayAuto,
    holidayState: s.holidayState,
    customHolidays: [...s.customHolidays],
    holidayExclusions: [...s.holidayExclusions],
    holidayOvernightAutoApprove: s.holidayOvernightAutoApprove,
    countPendingTowardCap: s.countPendingTowardCap,
    requirePlatePhotoOvernight: s.requirePlatePhotoOvernight,
    defaultPurpose: s.defaultPurpose,
  };
}

function formatHolidayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-MY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[rgb(var(--sr-border))]/70">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
          {icon}
        </span>
        <div>
          <h2 className="font-semibold tracking-tight leading-tight">{title}</h2>
          <p className="sr-muted text-sm mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-[rgb(var(--sr-border))]/60">{children}</div>
    </Card>
  );
}

function Row({
  label,
  helper,
  control,
}: {
  label: string;
  helper: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="sm:pr-6">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="sr-muted text-xs mt-1 leading-snug">{helper}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={`flex items-center gap-2${disabled ? ' opacity-50' : ''}`}>
      <div className="flex items-center rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))]">
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
          className="flex size-10 items-center justify-center rounded-l-xl text-[rgb(var(--sr-fg))] transition-colors hover:bg-[rgb(var(--sr-bg))] disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          aria-label="Value"
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="h-10 w-14 border-x border-[rgb(var(--sr-border))] bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
          className="flex size-10 items-center justify-center rounded-r-xl text-[rgb(var(--sr-fg))] transition-colors hover:bg-[rgb(var(--sr-bg))] disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {unit ? <span className="sr-muted text-xs w-14">{unit}</span> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-[rgb(var(--sr-coral))]' : 'bg-[rgb(var(--sr-border))]'
      }`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function VisitorSettingsPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const settingsQuery = useCondoVisitorSettings(api, condo?.id ?? null);
  const update = useUpdateCondoVisitorSettings(api);

  const [saved, setSaved] = useState<EditableSettings | null>(null);
  const [form, setForm] = useState<EditableSettings | null>(null);
  const [serverResolved, setServerResolved] = useState<ResolvedHoliday[]>([]);
  const [newHoliday, setNewHoliday] = useState('');

  useEffect(() => {
    if (settingsQuery.data) {
      const editable = toEditable(settingsQuery.data);
      setSaved(editable);
      setForm(editable);
      setServerResolved(settingsQuery.data.resolvedHolidays ?? []);
    }
  }, [settingsQuery.data]);

  const dirty = useMemo(
    () => Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)),
    [form, saved],
  );

  const holidaySourceDirty = useMemo(
    () =>
      Boolean(
        form &&
          saved &&
          (form.holidayAuto !== saved.holidayAuto || form.holidayState !== saved.holidayState),
      ),
    [form, saved],
  );

  // Effective holiday list shown to the admin: server-resolved auto+custom, plus locally added
  // customs, minus locally excluded dates. Auto dates for a newly changed state appear after save.
  const activeHolidays = useMemo<ResolvedHoliday[]>(() => {
    if (!form) return [];
    const excluded = new Set(form.holidayExclusions);
    const byDate = new Map<string, string>();
    if (form.holidayAuto) {
      for (const h of serverResolved) byDate.set(h.date, h.name);
    }
    for (const date of form.customHolidays) {
      if (!byDate.has(date)) byDate.set(date, 'Custom holiday');
    }
    for (const date of excluded) byDate.delete(date);
    return [...byDate.entries()]
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [form, serverResolved]);

  if (settingsQuery.isLoading || !form) {
    return (
      <div className="max-w-2xl flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  function patch<K extends keyof EditableSettings>(key: K, value: EditableSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleWeekday(day: number) {
    if (!form) return;
    const weekdays = form.workingDays.weekdays.includes(day)
      ? form.workingDays.weekdays.filter((d) => d !== day)
      : [...form.workingDays.weekdays, day].sort((a, b) => a - b);
    patch('workingDays', { weekdays });
  }

  function excludeHoliday(date: string) {
    if (!form) return;
    // If it was a local custom addition, just drop it; otherwise record an exclusion.
    if (form.customHolidays.includes(date)) {
      patch(
        'customHolidays',
        form.customHolidays.filter((d) => d !== date),
      );
      return;
    }
    if (!form.holidayExclusions.includes(date)) {
      patch('holidayExclusions', [...form.holidayExclusions, date].sort());
    }
  }

  function restoreHoliday(date: string) {
    if (!form) return;
    patch(
      'holidayExclusions',
      form.holidayExclusions.filter((d) => d !== date),
    );
  }

  function addCustomHoliday() {
    if (!form) return;
    const date = newHoliday.trim();
    if (!DATE_RE.test(date)) {
      toast.error('Enter a valid date');
      return;
    }
    setNewHoliday('');
    // Adding a date that was excluded simply un-excludes it.
    if (form.holidayExclusions.includes(date)) {
      restoreHoliday(date);
      return;
    }
    if (!form.customHolidays.includes(date)) {
      patch('customHolidays', [...form.customHolidays, date].sort());
    }
  }

  async function onSave() {
    if (!condo || !form) return;
    const payload: UpdateCondoVisitorSettingsInput = { ...form };
    try {
      const result = await update.mutateAsync({ condoId: condo.id, data: payload });
      const editable = toEditable(result);
      setSaved(editable);
      setForm(editable);
      setServerResolved(result.resolvedHolidays ?? []);
      toast.success('Visitor settings saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onDiscard() {
    if (saved) setForm(saved);
  }

  const excludedDates = form.holidayExclusions;

  return (
    <div className="max-w-2xl flex flex-col gap-5 pb-28">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('visitors.settings.title')}</h1>
        <p className="sr-muted text-sm mt-1">
          {t('visitors.settings.subtitle', { condo: condo?.name ?? 'your condo' })}
        </p>
      </header>

      <SectionCard
        icon={<Moon className="size-5" />}
        title={t('visitors.settings.sections.overnight')}
        description={t('visitors.settings.sections.overnightDesc')}
      >
        <Row
          label="Monthly overnight limit per unit"
          helper="How many overnight stays each unit can register in a calendar month."
          control={
            <Stepper
              value={form.maxOvernightVisitsPerUnitPerMonth}
              min={1}
              max={60}
              unit="/ month"
              onChange={(v) => patch('maxOvernightVisitsPerUnitPerMonth', v)}
            />
          }
        />
        <Row
          label="Overnight slots per night"
          helper="Total overnight guests allowed across the whole condo on a non-working night."
          control={
            <Stepper
              value={form.overnightSlotsPerNight}
              min={1}
              max={200}
              unit="/ night"
              onChange={(v) => patch('overnightSlotsPerNight', v)}
            />
          }
        />
        <Row
          label="Urgent overnight threshold"
          helper="Overnight requests with less notice than this are flagged urgent and need an in-person visit to management."
          control={
            <Stepper
              value={form.urgentOvernightMinHours}
              min={1}
              max={168}
              unit="hours"
              onChange={(v) => patch('urgentOvernightMinHours', v)}
            />
          }
        />
        <Row
          label="Require number plate photo"
          helper="Residents must upload a photo of the vehicle plate that matches what they typed."
          control={
            <Toggle
              label="Require number plate photo"
              checked={form.requirePlatePhotoOvernight}
              onChange={(v) => patch('requirePlatePhotoOvernight', v)}
            />
          }
        />
      </SectionCard>

      <SectionCard
        icon={<UserPlus className="size-5" />}
        title={t('visitors.settings.sections.walkIn')}
        description={t('visitors.settings.sections.walkInDesc')}
      >
        <Row
          label={t('visitors.settings.walkInRequireOwnerApproval')}
          helper={t('visitors.settings.walkInRequireOwnerApprovalDesc')}
          control={
            <Toggle
              label={t('visitors.settings.walkInRequireOwnerApproval')}
              checked={form.walkInRequireOwnerApproval}
              onChange={(v) => patch('walkInRequireOwnerApproval', v)}
            />
          }
        />
        <Row
          label="Walk-in approval timeout"
          helper="How long a resident has to approve a walk-in guest before the request expires at the gate."
          control={
            <Stepper
              value={form.walkInApprovalMinutes}
              min={1}
              max={120}
              unit="minutes"
              onChange={(v) => patch('walkInApprovalMinutes', v)}
              disabled={!form.walkInRequireOwnerApproval}
            />
          }
        />
        <Row
          label="Pre-registration grace period"
          helper="Extra time a pre-registered pass stays valid after the expected visit window ends."
          control={
            <Stepper
              value={form.preRegExpiryBufferMins}
              min={0}
              max={480}
              step={15}
              unit="minutes"
              onChange={(v) => patch('preRegExpiryBufferMins', v)}
            />
          }
        />
        <Row
          label="Default visit purpose"
          helper="Pre-selected purpose when a resident registers a new visitor."
          control={
            <div className="w-44">
              <Select
                value={form.defaultPurpose}
                onValueChange={(v) =>
                  patch('defaultPurpose', v as EditableSettings['defaultPurpose'])
                }
                options={PURPOSE_SELECT_OPTIONS}
                aria-label="Default visit purpose"
              />
            </div>
          }
        />
      </SectionCard>

      <SectionCard
        icon={<CalendarDays className="size-5" />}
        title="Working days & holidays"
        description="Overnight stays on non-working days and public holidays are auto-approved."
      >
        <div className="px-5 py-4">
          <p className="text-sm font-medium leading-tight">Working days</p>
          <p className="sr-muted text-xs mt-1 leading-snug">
            Days the management office is open. Overnight stays arriving on other days are
            auto-approved (subject to slots).
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {WEEKDAY_OPTIONS.map((d) => {
              const active = form.workingDays.weekdays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  aria-pressed={active}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                    active
                      ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]'
                      : 'border-[rgb(var(--sr-border))] sr-muted hover:bg-[rgb(var(--sr-bg))]'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <Row
          label="Auto-approve overnight on holidays"
          helper="When on, overnight visitors on public holidays are auto-approved if slots are available. When off, management must approve every overnight stay."
          control={
            <Toggle
              label="Auto-approve overnight on holidays"
              checked={form.holidayOvernightAutoApprove}
              onChange={(v) => patch('holidayOvernightAutoApprove', v)}
            />
          }
        />

        <Row
          label="Use Malaysian public holidays (auto)"
          helper="Automatically keep the official Malaysia public holiday list up to date — no manual entry needed."
          control={
            <Toggle
              label="Use Malaysian public holidays"
              checked={form.holidayAuto}
              onChange={(v) => patch('holidayAuto', v)}
            />
          }
        />

        {form.holidayAuto ? (
          <Row
            label="State for state holidays"
            helper="Federal holidays are always included. Pick your state to add its state-specific holidays."
            control={
              <div className="w-52">
                <Select
                  value={form.holidayState}
                  onValueChange={(v) => patch('holidayState', v)}
                  options={MY_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  aria-label="State for public holidays"
                />
              </div>
            }
          />
        ) : null}

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium leading-tight">
              Holidays in effect
              <span className="sr-muted font-normal"> · {activeHolidays.length}</span>
            </p>
          </div>

          {holidaySourceDirty ? (
            <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-2">
              Save to refresh the automatic holiday list for the selected option.
            </p>
          ) : null}

          {activeHolidays.length === 0 ? (
            <p className="sr-muted text-sm">No holidays configured yet.</p>
          ) : (
            <ul className="flex flex-col rounded-xl border border-[rgb(var(--sr-border))]/70 divide-y divide-[rgb(var(--sr-border))]/60 max-h-72 overflow-y-auto">
              {activeHolidays.map((h) => {
                const isCustom = form.customHolidays.includes(h.date);
                return (
                  <li key={h.date} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{h.name}</p>
                      <p className="text-meta">{formatHolidayDate(h.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCustom ? (
                        <span className="rounded-full bg-[rgb(var(--sr-coral)/0.1)] px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--sr-coral))]">
                          Custom
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Remove ${h.name}`}
                        onClick={() => excludeHoliday(h.date)}
                        className="flex size-7 items-center justify-center rounded-lg sr-muted transition-colors hover:bg-[rgb(var(--sr-bg))] hover:text-[rgb(var(--sr-fg))]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              aria-label="Add a custom holiday date"
              className="h-10 flex-1 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm focus:border-[rgb(var(--sr-coral))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30"
            />
            <Button type="button" variant="secondary" onClick={addCustomHoliday}>
              <CalendarPlus className="size-4" />
              Add date
            </Button>
          </div>

          {excludedDates.length > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-meta">Excluded ({excludedDates.length})</p>
              <div className="flex flex-wrap gap-2">
                {excludedDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => restoreHoliday(date)}
                    className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))] px-2.5 py-1 text-xs sr-muted hover:bg-[rgb(var(--sr-bg))]"
                  >
                    <Undo2 className="size-3" />
                    {formatHolidayDate(date)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        icon={<ShieldCheck className="size-5" />}
        title="Enforcement"
        description="How limits are counted and applied."
      >
        <Row
          label="Count pending requests toward the limit"
          helper="When on, overnight requests still awaiting management approval also use up a unit's monthly limit."
          control={
            <Toggle
              label="Count pending requests toward the limit"
              checked={form.countPendingTowardCap}
              onChange={(v) => patch('countPendingTowardCap', v)}
            />
          }
        />
      </SectionCard>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--sr-card))]/80">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 px-5 py-3 sm:px-0">
          <p className="text-sm sr-muted">
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <div className="flex items-center gap-2">
            {dirty ? (
              <Button variant="secondary" onClick={onDiscard} disabled={update.isPending}>
                <RotateCcw className="size-4" />
                Discard
              </Button>
            ) : null}
            <Button onClick={onSave} disabled={!dirty || update.isPending}>
              <Save className="size-4" />
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
