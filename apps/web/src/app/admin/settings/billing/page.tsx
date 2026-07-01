'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  type FeeRateRow,
  useAddFeeExtraLinePresets,
  useDeleteFeeExtraLine,
  useDeleteFeeRate,
  useDeleteGateway,
  useFeeExtraLines,
  useFeeRates,
  useGateways,
  useMyCondos,
  useReceiptTemplate,
  useSetGatewayEnabled,
  useUpdateReceiptTemplate,
  useUpsertFeeExtraLine,
  useUpsertFeeRate,
  useUpsertGateway,
} from '@smartresidence/api-client';
import type {
  FeeRateType,
  FeeScheduleExtraLine,
  FeeScheduleExtraLineFund,
  FeeScheduleLineRateType,
  GatewayMode,
  PaymentProvider,
  ReceiptTemplateConfig,
} from '@smartresidence/shared-types';
import {
  COMMON_FEE_SCHEDULE_PRESETS,
  CONNECTABLE_PROVIDERS,
  FEE_SCHEDULE_CATEGORY_FUND,
  FEE_SCHEDULE_CATEGORY_LABELS,
  FEE_SCHEDULE_EXTRA_LINE_FUND_LABELS,
  GATEWAY_CAPABILITIES,
  GATEWAY_CREDENTIAL_FIELDS,
  GATEWAY_PROVIDER_LABELS,
  GATEWAY_PROVIDER_SHORT_LABELS,
  formatMoney,
} from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@smartresidence/ui-web';
import { Check, CreditCard, FileText, Landmark, ReceiptText, X } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

function SettingsSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  icon: typeof FileText;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[rgb(var(--sr-border))]/70 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]">
            <Icon className="size-5 text-[rgb(var(--sr-coral))]" />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide sr-muted font-semibold">{eyebrow}</div>
            <h3 className="text-lg font-semibold mt-1">{title}</h3>
            <p className="text-sm sr-muted mt-1 max-w-3xl">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  );
}

const RATE_TYPE_OPTIONS: { value: FeeRateType; label: string }[] = [
  { value: 'PER_SQFT', label: 'Per sq ft' },
  { value: 'FLAT', label: 'Flat amount' },
];

const EXTRA_RATE_TYPE_OPTIONS: { value: FeeScheduleLineRateType; label: string; help: string }[] = [
  { value: 'FLAT', label: 'Flat per unit', help: 'Same amount for every unit' },
  { value: 'PER_SQFT', label: 'Per sq ft', help: 'Uses each unit floor area' },
  { value: 'PER_UNIT_TYPE', label: 'By unit type', help: 'Set a different amount by layout/type' },
];

const EXTRA_LINE_FUND_OPTIONS: { value: FeeScheduleExtraLineFund; label: string }[] = [
  { value: 'MAINTENANCE', label: FEE_SCHEDULE_EXTRA_LINE_FUND_LABELS.MAINTENANCE },
  { value: 'SINKING_FUND', label: FEE_SCHEDULE_EXTRA_LINE_FUND_LABELS.SINKING_FUND },
  { value: 'DEPOSIT', label: FEE_SCHEDULE_EXTRA_LINE_FUND_LABELS.DEPOSIT },
];

const FEATURED_PRESET_LABELS = new Set([
  'Fire insurance (sinking)',
  'Quit rent (maintenance)',
  'Sinking fund contribution',
]);

type EditableExtraLine = {
  id?: string;
  code: string;
  description: string;
  category: string;
  fund: FeeScheduleExtraLineFund;
  formula: string;
  rateType: FeeScheduleLineRateType;
  amount: number;
  unitTypeAmounts: Record<string, number>;
  recurring: boolean;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  enabled: boolean;
  sortOrder: number;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthFromDate(value?: Date | string | null) {
  return value ? new Date(value).toISOString().slice(0, 7) : currentMonth();
}

function monthStartIso(month: string) {
  return `${month}-01T00:00:00.000Z`;
}

function monthEndIso(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  return new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)).toISOString();
}

const emptyExtraLine = (): EditableExtraLine => ({
  code: 'FEE',
  description: '',
  category: 'OTHER',
  fund: 'MAINTENANCE',
  formula: '',
  rateType: 'FLAT',
  amount: 0,
  unitTypeAmounts: {},
  recurring: false,
  enabled: true,
  sortOrder: 100,
});

function toEditableExtraLine(line: FeeScheduleExtraLine): EditableExtraLine {
  return {
    id: line.id,
    code: line.code,
    description: line.description,
    category: line.category,
    fund: line.fund,
    formula: line.formula ?? '',
    rateType: line.rateType,
    amount: Number(line.amount),
    unitTypeAmounts: line.unitTypeAmounts ?? {},
    recurring: line.recurring,
    effectiveFrom: line.effectiveFrom ?? null,
    effectiveTo: line.effectiveTo ?? null,
    enabled: line.enabled,
    sortOrder: line.sortOrder,
  };
}

function FeeRateEditor({ condoId, row }: { condoId: string; row: FeeRateRow }) {
  const upsert = useUpsertFeeRate(api);
  const remove = useDeleteFeeRate(api);
  const rate = row.feeRate;
  const [maintType, setMaintType] = React.useState<FeeRateType>(
    rate?.maintenanceRateType ?? 'PER_SQFT',
  );
  const [maintAmount, setMaintAmount] = React.useState(rate ? String(rate.maintenanceAmount) : '');
  const [sinkType, setSinkType] = React.useState<FeeRateType>(
    rate?.sinkingFundRateType ?? 'PER_SQFT',
  );
  const [sinkAmount, setSinkAmount] = React.useState(rate ? String(rate.sinkingFundAmount) : '');

  async function save() {
    if (maintAmount === '' && sinkAmount === '') {
      toast.error('Enter at least one amount');
      return;
    }
    try {
      await upsert.mutateAsync({
        condoId,
        input: {
          unitTypeId: row.unitTypeId,
          maintenanceRateType: maintType,
          maintenanceAmount: maintAmount === '' ? 0 : Number(maintAmount),
          sinkingFundRateType: sinkType,
          sinkingFundAmount: sinkAmount === '' ? 0 : Number(sinkAmount),
        },
      });
      toast.success(`Saved fee rate for ${row.unitTypeName}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onClear() {
    try {
      await remove.mutateAsync({ condoId, unitTypeId: row.unitTypeId });
      setMaintAmount('');
      setSinkAmount('');
      toast.success('Fee rate removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/35 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold">{row.unitTypeName}</div>
          <div className="text-xs sr-muted">
            {row.unitCount} unit{row.unitCount === 1 ? '' : 's'}
            {rate ? ' using this rate' : ' · no rate set'}
          </div>
        </div>
        {rate ? <Badge tone="success">Configured</Badge> : <Badge tone="warning">Needs rate</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-3 mt-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
          <Label>Maintenance fee</Label>
          <p className="text-xs sr-muted mt-0.5 mb-2">Main monthly operating charge.</p>
          <div className="grid grid-cols-[minmax(120px,0.9fr)_minmax(120px,1fr)] gap-2">
            <select
              className={selectCls}
              value={maintType}
              onChange={(e) => setMaintType(e.target.value as FeeRateType)}
            >
              {RATE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={maintAmount}
              placeholder={maintType === 'PER_SQFT' ? '0.30' : '250.00'}
              onChange={(e) => setMaintAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
          <Label>Sinking fund</Label>
          <p className="text-xs sr-muted mt-0.5 mb-2">Reserve fund for long-term building works.</p>
          <div className="grid grid-cols-[minmax(120px,0.9fr)_minmax(120px,1fr)] gap-2">
            <select
              className={selectCls}
              value={sinkType}
              onChange={(e) => setSinkType(e.target.value as FeeRateType)}
            >
              {RATE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={sinkAmount}
              placeholder={sinkType === 'PER_SQFT' ? '0.05' : '40.00'}
              onChange={(e) => setSinkAmount(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[rgb(var(--sr-border))]/70 pt-3">
        <Button size="sm" disabled={upsert.isPending} onClick={() => void save()}>
          {upsert.isPending ? 'Saving…' : 'Save rate'}
        </Button>
        {rate ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => void onClear()}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ExtraFeeLineEditor({
  condoId,
  initial,
  unitTypes,
  onSaved,
  onCancel,
}: {
  condoId: string;
  initial: EditableExtraLine;
  unitTypes: FeeRateRow[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const upsert = useUpsertFeeExtraLine(api);
  const remove = useDeleteFeeExtraLine(api);
  const [draft, setDraft] = React.useState<EditableExtraLine>(initial);
  const [month, setMonth] = React.useState(monthFromDate(initial.effectiveFrom));

  React.useEffect(() => {
    setDraft(initial);
    setMonth(monthFromDate(initial.effectiveFrom));
  }, [initial]);

  function updateUnitTypeAmount(unitTypeId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      unitTypeAmounts: {
        ...prev.unitTypeAmounts,
        [unitTypeId]: value === '' ? 0 : Number(value),
      },
    }));
  }

  async function save() {
    if (!draft.description.trim()) {
      toast.error('Enter a fee description');
      return;
    }
    if (!draft.fund) {
      toast.error('Select a fund for this fee line');
      return;
    }
    try {
      await upsert.mutateAsync({
        condoId,
        input: {
          id: draft.id,
          code: draft.code.trim() || 'FEE',
          description: draft.description.trim(),
          category: draft.category,
          fund: draft.fund,
          formula: draft.formula.trim() || undefined,
          rateType: draft.rateType,
          amount: draft.rateType === 'PER_UNIT_TYPE' ? 0 : Number(draft.amount || 0),
          unitTypeAmounts: draft.rateType === 'PER_UNIT_TYPE' ? draft.unitTypeAmounts : undefined,
          recurring: draft.recurring,
          effectiveFrom: monthStartIso(month),
          effectiveTo: draft.recurring ? null : monthEndIso(month),
          enabled: draft.enabled,
          sortOrder: draft.sortOrder,
        },
      });
      toast.success('Fee schedule line saved');
      onSaved?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onRemove() {
    if (!draft.id) {
      onCancel?.();
      return;
    }
    if (!window.confirm(`Remove ${draft.description || draft.code} from the fee schedule?`)) return;
    try {
      await remove.mutateAsync({ condoId, id: draft.id });
      toast.success('Fee schedule line removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const selectedRate = EXTRA_RATE_TYPE_OPTIONS.find((o) => o.value === draft.rateType);

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-4 ${
        draft.enabled
          ? 'border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/30'
          : 'border-dashed border-[rgb(var(--sr-border))]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{draft.description || 'New fee line'}</span>
            {!draft.enabled ? <Badge tone="neutral">Disabled</Badge> : null}
            {draft.recurring ? (
              <Badge tone="info">Recurring</Badge>
            ) : (
              <Badge tone="warning">One-off</Badge>
            )}
            <Badge tone="neutral">{FEE_SCHEDULE_EXTRA_LINE_FUND_LABELS[draft.fund]}</Badge>
          </div>
          <p className="text-xs sr-muted mt-0.5">
            {selectedRate?.help}. Zero amounts are saved but skipped during invoice generation.
          </p>
          <p className="text-xs sr-muted mt-1">
            Under the Strata Management Act, maintenance and sinking fund collections must be kept
            separate. Assign each recurring charge to the correct fund so ledger reports stay
            accurate.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="size-4 rounded border-[rgb(var(--sr-border))]"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.75fr_1.5fr_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label>Code</Label>
          <Input
            value={draft.code}
            placeholder="FIRE"
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Description shown on invoice</Label>
          <Input
            value={draft.description}
            placeholder="Fire insurance premium"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <select
            className={selectCls}
            value={draft.category}
            onChange={(e) => {
              const category = e.target.value;
              const mapped =
                category in FEE_SCHEDULE_CATEGORY_FUND
                  ? FEE_SCHEDULE_CATEGORY_FUND[category as keyof typeof FEE_SCHEDULE_CATEGORY_FUND]
                  : draft.fund;
              setDraft({ ...draft, category, fund: mapped });
            }}
          >
            {Object.entries(FEE_SCHEDULE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fund (required)</Label>
          <select
            className={selectCls}
            value={draft.fund}
            required
            onChange={(e) =>
              setDraft({ ...draft, fund: e.target.value as FeeScheduleExtraLineFund })
            }
          >
            {EXTRA_LINE_FUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Applies to</Label>
          <input
            type="month"
            className={selectCls}
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
          <p className="text-xs sr-muted">
            {draft.recurring
              ? 'Starts from this month and repeats monthly.'
              : 'Only this billing month.'}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Charging method</Label>
          <select
            className={selectCls}
            value={draft.rateType}
            onChange={(e) =>
              setDraft({ ...draft, rateType: e.target.value as FeeScheduleLineRateType })
            }
          >
            {EXTRA_RATE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{draft.rateType === 'PER_SQFT' ? 'Rate per sq ft (MYR)' : 'Amount (MYR)'}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={draft.rateType === 'PER_UNIT_TYPE'}
            value={draft.rateType === 'PER_UNIT_TYPE' ? '' : String(draft.amount || '')}
            placeholder={draft.rateType === 'PER_SQFT' ? '0.02' : '20.00'}
            onChange={(e) =>
              setDraft({ ...draft, amount: e.target.value === '' ? 0 : Number(e.target.value) })
            }
          />
        </div>
      </div>

      <label className="inline-flex items-start gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3 text-sm">
        <input
          type="checkbox"
          checked={draft.recurring}
          onChange={(e) => setDraft({ ...draft, recurring: e.target.checked })}
          className="mt-0.5 size-4 rounded border-[rgb(var(--sr-border))]"
        />
        <span>
          <span className="block font-medium">Repeat this fee every month</span>
          <span className="block text-xs sr-muted">
            Leave unticked for a one-off charge in the selected billing month.
          </span>
        </span>
      </label>

      {draft.rateType === 'PER_UNIT_TYPE' ? (
        <div className="rounded-xl bg-[rgb(var(--sr-card))] border border-[rgb(var(--sr-border))]/70 p-3">
          <Label>Amount by unit type</Label>
          <p className="text-xs sr-muted mt-0.5">
            Use this when larger/smaller layouts should pay different amounts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {unitTypes.map((row) => (
              <div key={row.unitTypeId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-sm">
                  {row.unitTypeName}{' '}
                  <span className="text-xs sr-muted">({row.unitCount} units)</span>
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="max-w-32"
                  value={String(draft.unitTypeAmounts[row.unitTypeId] || '')}
                  placeholder="0.00"
                  onChange={(e) => updateUnitTypeAmount(row.unitTypeId, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>Formula / note for residents (optional)</Label>
        <Input
          value={draft.formula}
          placeholder="e.g. Annual premium divided equally across all units"
          onChange={(e) => setDraft({ ...draft, formula: e.target.value })}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--sr-border))]/70 pt-3 sm:flex-row sm:justify-end">
        <Button size="sm" disabled={upsert.isPending} onClick={() => void save()}>
          {upsert.isPending ? 'Saving…' : 'Save fee line'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={remove.isPending}
          onClick={() => void onRemove()}
        >
          {draft.id ? 'Remove' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}

function ExtraFeeSchedule({ condoId, unitTypes }: { condoId: string; unitTypes: FeeRateRow[] }) {
  const lines = useFeeExtraLines(api, condoId);
  const addPresets = useAddFeeExtraLinePresets(api);
  const [presetMonth, setPresetMonth] = React.useState(currentMonth());
  const [draftOpen, setDraftOpen] = React.useState(false);
  const totalActive = (lines.data ?? [])
    .filter((line) => line.enabled && line.rateType !== 'PER_UNIT_TYPE' && Number(line.amount) > 0)
    .reduce((sum, line) => sum + Number(line.amount), 0);

  async function onAddPresets(categories?: string[]) {
    try {
      const res = await addPresets.mutateAsync({
        condoId,
        input: {
          month: presetMonth,
          recurring: false,
          presetCodes: categories ?? COMMON_FEE_SCHEDULE_PRESETS.map((p) => p.code),
        },
      });
      const skipped = res.skipped ? ` · ${res.skipped} already existed` : '';
      toast.success(
        `Added ${res.created} preset fee line${res.created === 1 ? '' : 's'}${skipped}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const featuredPresets = COMMON_FEE_SCHEDULE_PRESETS.filter((p) =>
    FEATURED_PRESET_LABELS.has(p.label),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
        <div>
          <h4 className="font-semibold">One-off and recurring extra charges</h4>
          <p className="text-sm sr-muted mt-1">
            Add real-life charges like fire insurance, quit rent, assessment or a special levy.
            Enabled non-zero lines are added automatically when invoices are generated from the fee
            schedule. Each line must be assigned to a maintenance or sinking fund — not General — to
            comply with Strata Act fund separation.
          </p>
          {totalActive > 0 ? (
            <p className="text-xs sr-muted mt-2">
              Flat/per-sqft configured amount total: {formatMoney(totalActive)}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/45 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Preset billing month</Label>
              <input
                type="month"
                className={selectCls}
                value={presetMonth}
                onChange={(e) => setPresetMonth(e.target.value || currentMonth())}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {featuredPresets.map((preset) => (
              <Button
                key={preset.code}
                size="sm"
                variant="secondary"
                disabled={addPresets.isPending}
                onClick={() => void onAddPresets([preset.code])}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={addPresets.isPending}
              onClick={() => void onAddPresets()}
            >
              {addPresets.isPending ? 'Adding…' : 'Add all presets'}
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-[rgb(var(--sr-coral))] hover:underline"
            onClick={() => setDraftOpen(true)}
          >
            Add a custom fee line
          </button>
        </div>
      </div>

      {draftOpen ? (
        <ExtraFeeLineEditor
          condoId={condoId}
          initial={{
            ...emptyExtraLine(),
            effectiveFrom: monthStartIso(presetMonth),
            effectiveTo: monthEndIso(presetMonth),
          }}
          unitTypes={unitTypes}
          onSaved={() => setDraftOpen(false)}
          onCancel={() => setDraftOpen(false)}
        />
      ) : null}

      {lines.isLoading ? (
        <Skeleton className="h-32" />
      ) : (lines.data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--sr-border))] p-5 text-sm sr-muted">
          No additional charges yet. Use <span className="font-medium">Add common fees</span> for
          one-click Fire insurance, Quit rent, Assessment and Special levy lines.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(lines.data ?? []).map((line) => (
            <ExtraFeeLineEditor
              key={line.id}
              condoId={condoId}
              initial={toEditableExtraLine(line)}
              unitTypes={unitTypes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TEMPLATE_FIELDS: { key: keyof ReceiptTemplateConfig; label: string; textarea?: boolean }[] = [
  { key: 'organizationName', label: 'Organisation / JMB name' },
  { key: 'registrationNo', label: 'Registration number' },
  { key: 'addressLines', label: 'Address (one line each)', textarea: true },
  { key: 'numberPrefix', label: 'Receipt number prefix' },
  { key: 'signatoryName', label: 'Signatory name' },
  { key: 'signatoryTitle', label: 'Signatory title' },
  { key: 'footerNote', label: 'Footer note' },
  { key: 'logoUrl', label: 'Logo URL (optional)' },
];

function ReceiptTemplateForm({ condoId }: { condoId: string }) {
  const template = useReceiptTemplate(api, condoId);
  const update = useUpdateReceiptTemplate(api);
  const [draft, setDraft] = React.useState<ReceiptTemplateConfig | null>(null);

  React.useEffect(() => {
    if (template.data) setDraft(template.data);
  }, [template.data]);

  if (template.isLoading || !draft) return <Skeleton className="h-72" />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      await update.mutateAsync({ condoId, input: draft });
      toast.success('Receipt template saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TEMPLATE_FIELDS.map((field) => (
          <div
            key={field.key}
            className={`flex flex-col gap-1.5 ${field.textarea ? 'sm:col-span-2' : ''}`}
          >
            <Label htmlFor={`tpl-${field.key}`}>{field.label}</Label>
            {field.textarea ? (
              <textarea
                id={`tpl-${field.key}`}
                className={`${selectCls} min-h-20`}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            ) : (
              <Input
                id={`tpl-${field.key}`}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-[rgb(var(--sr-border))]/70 pt-4">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save template'}
        </Button>
      </div>
    </form>
  );
}

function GatewayProviderCard({
  condoId,
  provider,
  connection,
}: {
  condoId: string;
  provider: PaymentProvider;
  connection?: {
    id: string;
    mode: GatewayMode;
    enabled: boolean;
    configured: boolean;
    publicConfig?: Record<string, unknown>;
  };
}) {
  const upsert = useUpsertGateway(api);
  const setEnabled = useSetGatewayEnabled(api);
  const remove = useDeleteGateway(api);
  const fields = GATEWAY_CREDENTIAL_FIELDS[provider] ?? [];
  const [mode, setMode] = React.useState<GatewayMode>(connection?.mode ?? 'TEST');
  const [creds, setCreds] = React.useState<Record<string, string>>({});
  const [extendedVcode, setExtendedVcode] = React.useState(
    connection?.publicConfig?.extendedVcode !== false,
  );

  async function save() {
    const filled = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(filled).length === 0 && !connection) {
      toast.error('Enter the gateway credentials');
      return;
    }
    try {
      await upsert.mutateAsync({
        condoId,
        input: {
          provider,
          mode,
          credentials: Object.keys(filled).length ? filled : undefined,
          publicConfig: provider === 'RAZER' ? { extendedVcode } : undefined,
        },
      });
      setCreds({});
      toast.success(`${GATEWAY_PROVIDER_LABELS[provider]} saved`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleToggle(nextEnabled: boolean) {
    if (!connection) return;
    if (
      nextEnabled &&
      connection.mode === 'LIVE' &&
      !window.confirm(
        `Enable LIVE ${GATEWAY_PROVIDER_LABELS[provider]} payments? Residents will be able to pay with real money.`,
      )
    ) {
      return;
    }
    try {
      await setEnabled.mutateAsync({
        condoId,
        id: connection.id,
        enabled: nextEnabled,
      });
      toast.success(nextEnabled ? 'Gateway enabled' : 'Gateway disabled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeConnection() {
    if (!connection) return;
    if (
      !window.confirm(
        `Remove ${GATEWAY_PROVIDER_LABELS[provider]} ${connection.mode} credentials? Online payments through this connection will stop.`,
      )
    ) {
      return;
    }
    try {
      await remove.mutateAsync({ condoId, id: connection.id });
      toast.success('Gateway removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const capability = GATEWAY_CAPABILITIES[provider];
  const canEnable = Boolean(connection?.configured);

  return (
    <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {GATEWAY_PROVIDER_SHORT_LABELS[provider] ?? GATEWAY_PROVIDER_LABELS[provider]}
            </span>
            {connection?.configured ? (
              <Badge tone="success">Credentials saved</Badge>
            ) : (
              <Badge tone="neutral">Not set up</Badge>
            )}
            {connection?.configured ? (
              <Badge tone={connection.mode === 'LIVE' ? 'warning' : 'info'}>
                {connection.mode === 'LIVE' ? 'LIVE' : 'TEST'}
              </Badge>
            ) : null}
          </div>
          {capability ? <p className="text-sm sr-muted mt-1">{capability.tagline}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{connection?.enabled ? 'On' : 'Off'}</span>
            <Switch
              checked={Boolean(connection?.enabled)}
              disabled={!canEnable || setEnabled.isPending}
              onCheckedChange={(next) => void handleToggle(next)}
              aria-label={`Enable ${GATEWAY_PROVIDER_SHORT_LABELS[provider] ?? provider} for residents`}
            />
          </div>
          {!canEnable ? (
            <span className="text-xs sr-muted">Save credentials to turn on</span>
          ) : null}
        </div>
      </div>

      {capability ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide sr-muted">Accepts</div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {capability.accepts.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide sr-muted">
              Does not do
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {capability.limitations.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <X className="mt-0.5 size-4 shrink-0 text-stone-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs sr-muted">{capability.checkout}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 mt-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Mode</Label>
          <select
            className={selectCls}
            value={mode}
            onChange={(e) => setMode(e.target.value as GatewayMode)}
          >
            <option value="TEST">TEST — sandbox, no real money</option>
            <option value="LIVE">LIVE — real payments from residents</option>
          </select>
          {provider === 'RAZER' ? (
            <p className="text-xs sr-muted mt-1">
              {mode === 'LIVE'
                ? 'Live mode charges real money via pay.fiuu.com. Use your production Merchant ID, Verify key and Secret key.'
                : 'Test mode only works with a Fiuu sandbox merchant account (sandbox-payment.fiuu.com). Do not use live credentials here.'}
            </p>
          ) : null}
        </div>
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`gw-${provider}-${f.key}`}>{f.label}</Label>
            <Input
              id={`gw-${provider}-${f.key}`}
              type="password"
              autoComplete="off"
              placeholder={connection?.configured ? '•••••••• (stored)' : ''}
              value={creds[f.key] ?? ''}
              onChange={(e) => setCreds((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        {provider === 'RAZER' ? (
          <div className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              id={`gw-${provider}-extended-vcode`}
              type="checkbox"
              checked={extendedVcode}
              onChange={(e) => setExtendedVcode(e.target.checked)}
              className="size-4 rounded border-[rgb(var(--sr-border))]"
            />
            <Label htmlFor={`gw-${provider}-extended-vcode`} className="font-normal cursor-pointer">
              Extended vcode (include currency in hash) — match Fiuu portal → Transactions →
              Settings → “Use extended format for Verify Payment”
            </Label>
          </div>
        ) : null}
        {provider === 'DUITNOW_QR' ? (
          <p className="sm:col-span-2 text-xs sr-muted">
            TEST mode without credentials generates a local sandbox QR (no PayNet call). Simulate
            settlement with{' '}
            <code className="text-[11px]">
              POST /api/webhooks/payments/duitnow-qr/sandbox/settle
            </code>{' '}
            and body{' '}
            <code className="text-[11px]">{`{ "billRef": "<ref from QR>", "amount": "100.00" }`}</code>
            .
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-[rgb(var(--sr-border))]/70 pt-3 sm:flex-row sm:justify-end">
        <Button size="sm" disabled={upsert.isPending} onClick={() => void save()}>
          {upsert.isPending
            ? 'Saving…'
            : connection?.configured
              ? 'Update credentials'
              : 'Save credentials'}
        </Button>
        {connection ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => void removeConnection()}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GatewaySettings({ condoId }: { condoId: string }) {
  const gateways = useGateways(api, condoId);
  const connections = gateways.data ?? [];

  const enabledCount = connections.filter((c) => c.enabled).length;

  return (
    <div>
      {gateways.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/50 px-4 py-3 text-sm sr-muted">
            You can turn on more than one gateway. Residents will see every method that is switched
            on when they pay.
            {enabledCount > 0
              ? ` ${enabledCount} gateway${enabledCount === 1 ? ' is' : 's are'} on now.`
              : ' No gateways are on yet.'}
          </p>
          {CONNECTABLE_PROVIDERS.map((provider) => (
            <GatewayProviderCard
              key={provider}
              condoId={condoId}
              provider={provider}
              connection={connections.find((c) => c.provider === provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminBillingSettingsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const feeRates = useFeeRates(api, condoId);
  const configuredRateCount = (feeRates.data ?? []).filter((row) => row.feeRate).length;
  const totalUnitTypes = feeRates.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <header className="rounded-3xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm sr-muted">Billing setup</p>
            <h2 className="text-3xl font-bold tracking-tight">Billing & receipts</h2>
            <p className="sr-muted mt-2 max-w-3xl">
              Configure what gets charged, what appears on receipts, and which payment gateways
              residents can use. Maintenance and sinking fund rates are billed to separate ledger
              accounts — required under the Strata Management Act 2013. Invoice automation lives in
              the Invoices tab.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/50 px-4 py-3">
              <div className="text-xs uppercase sr-muted font-semibold">Unit type rates</div>
              <div className="mt-1 font-semibold">
                {configuredRateCount}/{totalUnitTypes || '—'} configured
              </div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/50 px-4 py-3">
              <div className="text-xs uppercase sr-muted font-semibold">Currency</div>
              <div className="mt-1 font-semibold">MYR</div>
            </div>
          </div>
        </div>
      </header>

      <Card className="!p-4 border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/35">
        <p className="text-sm sr-muted">
          <span className="font-medium text-[rgb(var(--sr-fg))]">Auditor note:</span> MAINT and
          SINKING invoice lines post to the maintenance account and sinking fund respectively.
          Renovation and access-card deposits post to deposits held — never mixed with maintenance
          cash. Review fund balances under Accounting.
        </p>
      </Card>

      <SettingsSection
        icon={Landmark}
        eyebrow="Monthly charges"
        title="Base maintenance and sinking fund"
        description="Set the standard monthly amount for each unit type. Per sq ft rates use the unit floor area; flat rates charge the same amount for every unit of that type."
      >
        {feeRates.isLoading ? (
          <Skeleton className="h-40" />
        ) : (feeRates.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No unit types yet"
            description="Create unit types first, then set a fee rate for each."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(feeRates.data ?? []).map((row) =>
              condoId ? <FeeRateEditor key={row.unitTypeId} condoId={condoId} row={row} /> : null,
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        icon={FileText}
        eyebrow="Extra charges"
        title="Additional monthly charges"
        description="Add common real-life charges such as fire insurance, quit rent, assessment, facility charges or special levies. These lines are included automatically when invoices are generated from the fee schedule."
      >
        {condoId && feeRates.data ? (
          <ExtraFeeSchedule condoId={condoId} unitTypes={feeRates.data} />
        ) : (
          <Skeleton className="h-32" />
        )}
      </SettingsSection>

      <SettingsSection
        icon={ReceiptText}
        eyebrow="Official documents"
        title="Receipt template"
        description="These details appear on every generated receipt PDF. The template is snapshotted at issue time, so changing it never alters receipts already issued."
      >
        {condoId ? <ReceiptTemplateForm condoId={condoId} /> : <Skeleton className="h-72" />}
      </SettingsSection>

      <SettingsSection
        icon={CreditCard}
        eyebrow="Online collection"
        title="Payment gateways"
        description="Connect Stripe, Fiuu, iPay88 or DuitNow QR. Each card shows what the gateway can accept. Save credentials, then use the on/off switch to let residents pay. Credentials are encrypted and never shown again; use TEST while setting up, then switch to LIVE."
      >
        {condoId ? <GatewaySettings condoId={condoId} /> : <Skeleton className="h-40" />}
      </SettingsSection>
    </div>
  );
}
