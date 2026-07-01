'use client';

import { AdminPageHeader } from '@/components/admin-ui';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  type DepositListItem,
  useCondoDeposits,
  useCondoUnitsSearch,
  useMyCondos,
  useRecordDeposit,
  useRefundDeposit,
} from '@smartresidence/api-client';
import type { DepositStatus, DepositType } from '@smartresidence/shared-types';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_TYPE_LABELS,
  depositHeldAmount,
  formatCompactUnitLabel,
  formatMoney,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Download, Plus, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

const STATUS_TONE: Record<DepositStatus, 'success' | 'neutral' | 'info' | 'warning'> = {
  HELD: 'info',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'success',
  FORFEITED: 'neutral',
};

const STATUS_FILTERS: { value: '' | DepositStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'HELD', label: 'Still held' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partly refunded' },
  { value: 'REFUNDED', label: 'Fully refunded' },
  { value: 'FORFEITED', label: 'Forfeited' },
];

const DEPOSIT_TYPES = Object.keys(DEPOSIT_TYPE_LABELS) as DepositType[];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

type UnitRow = {
  id: string;
  identifier: string;
  block?: { name?: string } | null;
  ownerships?: Array<{ user?: { id: string; name: string } | null }>;
};

type DepositAction = 'REFUND_FULL' | 'REFUND_PARTIAL' | 'FORFEIT_FULL' | 'FORFEIT_PARTIAL';

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function downloadReceipt(receiptId: string, number: string) {
  try {
    const blob = await api.downloadReceiptPdf(receiptId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error((err as Error).message);
  }
}

function depositUnitLabel(deposit: DepositListItem) {
  return deposit.unit ? formatCompactUnitLabel(deposit.unit) : 'No unit';
}

function buildDepositSummary(items: DepositListItem[]) {
  return items.reduce(
    (acc, d) => {
      const held = depositHeldAmount(d);
      acc.total += Number(d.amount);
      acc.held += held;
      acc.refunded += Number(d.refundedAmount);
      acc.forfeited += Number(d.forfeitedAmount);
      if (held > 0) acc.active += 1;
      acc.units.add(d.unitId);
      return acc;
    },
    {
      total: 0,
      held: 0,
      refunded: 0,
      forfeited: 0,
      active: 0,
      units: new Set<string>(),
    },
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
      : tone === 'warning'
        ? 'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
        : '';
  return (
    <Card className={toneClass}>
      <div className="text-xs uppercase sr-muted font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {detail ? <div className="text-xs sr-muted mt-0.5">{detail}</div> : null}
    </Card>
  );
}

function UnitSelect({
  condoId,
  value,
  onChange,
  label = 'Unit',
}: {
  condoId: string;
  value: string;
  onChange: (value: string, unit?: UnitRow) => void;
  label?: string;
}) {
  const [search, setSearch] = React.useState('');
  const units = useCondoUnitsSearch(api, condoId, search);
  const unitItems = (units.data?.items ?? []) as UnitRow[];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${label}-search`}>Find unit</Label>
        <Input
          id={`${label}-search`}
          value={search}
          placeholder="Search unit, block or owner..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${label}-select`}>{label}</Label>
        <select
          id={`${label}-select`}
          className={selectCls}
          value={value}
          onChange={(e) => {
            const unit = unitItems.find((u) => u.id === e.target.value);
            onChange(e.target.value, unit);
          }}
        >
          <option value="">All units</option>
          {unitItems.map((u) => (
            <option key={u.id} value={u.id}>
              {formatCompactUnitLabel(u)}
              {u.ownerships?.[0]?.user?.name ? ` · ${u.ownerships[0].user?.name}` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function RecordDepositForm({ condoId, onDone }: { condoId: string; onDone: () => void }) {
  const record = useRecordDeposit(api);
  const [unitId, setUnitId] = React.useState('');
  const [selectedUnit, setSelectedUnit] = React.useState<UnitRow | undefined>();
  const [type, setType] = React.useState<DepositType>('RENOVATION');
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('CASH');
  const [reference, setReference] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const ownerId = selectedUnit?.ownerships?.[0]?.user?.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId) {
      toast.error('Select a unit');
      return;
    }
    if (amount === '' || Number(amount) <= 0) {
      toast.error('Enter an amount');
      return;
    }
    const unitLabel = selectedUnit ? formatCompactUnitLabel(selectedUnit) : 'selected unit';
    if (
      !window.confirm(
        `Record ${formatMoney(Number(amount))} ${DEPOSIT_TYPE_LABELS[type]} for ${unitLabel}? A receipt will be issued.`,
      )
    ) {
      return;
    }
    try {
      await record.mutateAsync({
        unitId,
        userId: ownerId,
        type,
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Deposit recorded and receipt issued');
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="!p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold">Record a deposit</h3>
          <p className="sr-muted text-sm mt-1">
            Deposits are tracked per unit and receipt-issued immediately for audit follow-up.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={onDone}>
          <X className="size-4" />
        </Button>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <UnitSelect
          condoId={condoId}
          value={unitId}
          label="Unit"
          onChange={(value, unit) => {
            setUnitId(value);
            setSelectedUnit(unit);
          }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-type">Deposit type</Label>
            <select
              id="dep-type"
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as DepositType)}
            >
              {DEPOSIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEPOSIT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-amount">Amount (MYR)</Label>
            <Input
              id="dep-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder="1000.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-method">Method</Label>
            <select
              id="dep-method"
              className={selectCls}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-ref">Reference</Label>
            <Input
              id="dep-ref"
              value={reference}
              placeholder="Receipt / txn no."
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="dep-notes">Notes (optional)</Label>
            <Input id="dep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-[rgb(var(--sr-border))]/70">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending ? 'Recording...' : 'Record deposit'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DepositActionForm({ deposit, onDone }: { deposit: DepositListItem; onDone: () => void }) {
  const refund = useRefundDeposit(api);
  const held = depositHeldAmount(deposit);
  const [action, setAction] = React.useState<DepositAction>('REFUND_FULL');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');

  const isForfeit = action.startsWith('FORFEIT');
  const isFull = action.endsWith('FULL');
  const actionAmount = isFull ? held : Number(amount);
  const actionLabel = isForfeit ? 'forfeit' : 'refund';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFull && (amount === '' || Number(amount) <= 0)) {
      toast.error(`Enter an amount to ${actionLabel}`);
      return;
    }
    if (actionAmount > held + 0.005) {
      toast.error('Amount exceeds held balance');
      return;
    }
    if (
      !window.confirm(
        `Confirm ${actionLabel} of ${formatMoney(actionAmount, deposit.currencyCode)} for ${depositUnitLabel(deposit)}?`,
      )
    ) {
      return;
    }
    try {
      await refund.mutateAsync({
        id: deposit.id,
        input: {
          amount: isFull ? undefined : actionAmount,
          forfeit: isForfeit,
          note: note.trim() || undefined,
        },
      });
      toast.success(isForfeit ? 'Deposit forfeiture recorded' : 'Deposit refund recorded');
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form
      className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-4 flex flex-col gap-3 bg-[rgb(var(--sr-bg))]/40"
      onSubmit={submit}
    >
      <div>
        <p className="text-sm font-semibold">Close / adjust deposit</p>
        <p className="text-xs sr-muted mt-0.5">
          Held balance: {formatMoney(held, deposit.currencyCode)}. Choose refund when money is
          returned, or forfeit when management keeps all/part of the deposit.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['REFUND_FULL', 'Full refund'],
          ['REFUND_PARTIAL', 'Partial refund'],
          ['FORFEIT_FULL', 'Full forfeit'],
          ['FORFEIT_PARTIAL', 'Partial forfeit'],
        ].map(([value, label]) => (
          <label
            key={value}
            className={`rounded-xl border p-3 text-sm cursor-pointer ${
              action === value
                ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.07)]'
                : 'border-[rgb(var(--sr-border))]'
            }`}
          >
            <input
              type="radio"
              name={`deposit-action-${deposit.id}`}
              className="mr-2"
              checked={action === value}
              onChange={() => setAction(value as DepositAction)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {!isFull ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs sr-muted">Amount</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder={held.toFixed(2)}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs sr-muted">Reason / note</span>
          <Input
            value={note}
            placeholder="e.g. renovation completed, damage offset, access card returned"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={refund.isPending}>
          {refund.isPending ? 'Saving...' : isForfeit ? 'Record forfeit' : 'Record refund'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AdminDepositsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const [status, setStatus] = React.useState<'' | DepositStatus>('HELD');
  const [type, setType] = React.useState<'' | DepositType>('');
  const [unitId, setUnitId] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);

  const deposits = useCondoDeposits(api, condoId, {
    ...(status ? { status } : {}),
    ...(unitId ? { unitId } : {}),
  });
  const serverItems = deposits.data?.items ?? [];
  const items = type ? serverItems.filter((d) => d.type === type) : serverItems;
  const summary = buildDepositSummary(serverItems);
  const visibleSummary = buildDepositSummary(items);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <AdminPageHeader
        eyebrow="Money"
        title="Deposits"
        description="Track renovation, access card and other deposits by unit. Record refunds or forfeitures and keep receipt copies on file."
        actions={
          <Button disabled={!condoId} onClick={() => setComposeOpen((v) => !v)}>
            <Plus className="size-4" />
            Record deposit
          </Button>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="Still held"
          value={formatMoney(summary.held)}
          detail={`${summary.active} deposit(s) with balance held`}
          tone={summary.held > 0 ? 'warning' : 'success'}
        />
        <SummaryCard
          label="Total collected"
          value={formatMoney(summary.total)}
          detail={`${summary.units.size} unit(s) with deposits`}
        />
        <SummaryCard label="Refunded" value={formatMoney(summary.refunded)} />
        <SummaryCard label="Forfeited" value={formatMoney(summary.forfeited)} />
      </section>

      {composeOpen && condoId ? (
        <RecordDepositForm condoId={condoId} onDone={() => setComposeOpen(false)} />
      ) : null}

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="size-4 sr-muted" />
          <h3 className="font-semibold">Find deposits</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-4">
          {condoId ? (
            <UnitSelect
              condoId={condoId}
              value={unitId}
              label="Filter unit"
              onChange={(value) => setUnitId(value)}
            />
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-status-filter">Status</Label>
            <select
              id="dep-status-filter"
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | DepositStatus)}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value || 'all'} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dep-type-filter">Type</Label>
            <select
              id="dep-type-filter"
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as '' | DepositType)}
            >
              <option value="">All types</option>
              {DEPOSIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEPOSIT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm sr-muted">
          <Search className="size-4" />
          Showing {items.length} of {serverItems.length} loaded deposit(s). Visible held balance:{' '}
          <span className="font-medium text-[rgb(var(--sr-fg))]">
            {formatMoney(visibleSummary.held)}
          </span>
        </div>
      </Card>

      {deposits.isLoading ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No deposits found"
          description="Adjust filters or record a new deposit for a unit."
        />
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="text-left text-xs uppercase sr-muted border-b border-[rgb(var(--sr-border))]">
              <tr>
                <th className="px-4 py-3 align-middle whitespace-nowrap">Unit</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap">Type</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap">Payer</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-right">Original</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-right">Refunded</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-right">Forfeited</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-right">Held</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-center">Status</th>
                <th className="px-3 py-3 align-middle whitespace-nowrap text-center">Receipt</th>
                <th className="px-4 py-3 align-middle whitespace-nowrap text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {items.map((d) => {
                const held = depositHeldAmount(d);
                const receipt = d.receipt;
                return (
                  <React.Fragment key={d.id}>
                    <tr className="align-middle">
                      <td className="px-4 py-3 align-middle">
                        <div className="whitespace-nowrap">
                          <div className="font-medium leading-5">{depositUnitLabel(d)}</div>
                          <div className="text-xs sr-muted leading-5">Paid {fmtDate(d.paidAt)}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap">
                        {DEPOSIT_TYPE_LABELS[d.type]}
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap sr-muted">
                        {d.user?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-right tabular-nums">
                        {formatMoney(d.amount, d.currencyCode)}
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-right tabular-nums">
                        {formatMoney(d.refundedAmount, d.currencyCode)}
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-right tabular-nums">
                        {formatMoney(d.forfeitedAmount, d.currencyCode)}
                      </td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-right font-medium tabular-nums">
                        {formatMoney(held, d.currencyCode)}
                      </td>
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        <Badge tone={STATUS_TONE[d.status]}>
                          {DEPOSIT_STATUS_LABELS[d.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        {receipt ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-[rgb(var(--sr-coral))] hover:underline text-xs"
                            onClick={() => downloadReceipt(receipt.id, receipt.number)}
                          >
                            <Download className="size-3.5" />
                            {receipt.number}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                        {held > 0 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActionId((p) => (p === d.id ? null : d.id))}
                          >
                            Close / adjust
                          </Button>
                        ) : (
                          <ShieldCheck className="ml-auto size-4 text-emerald-600" />
                        )}
                      </td>
                    </tr>
                    {actionId === d.id ? (
                      <tr>
                        <td colSpan={10} className="px-4 pb-4 align-middle">
                          <DepositActionForm deposit={d} onDone={() => setActionId(null)} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
