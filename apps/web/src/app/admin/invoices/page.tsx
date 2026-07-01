'use client';

import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { toast } from '@/lib/toast';
import {
  queryKeys,
  useCancelEInvoice,
  useCondoInvoices,
  useCondoUnitsSearch,
  useEInvoice,
  useGenerateRecurringInvoices,
  useMe,
  useMyCondos,
  useRecordManualPayment,
  useRunInvoiceDueSweep,
  useSubmitEInvoice,
  useUnitInvoices,
  useVoidInvoice,
} from '@smartresidence/api-client';
import type { Invoice, InvoiceStatus } from '@smartresidence/shared-types';
import {
  EINVOICE_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  eInvoiceStatusTone,
  formatMoney,
  invoiceOutstanding,
  paymentStatusTone,
  visibleInvoicePayments,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, Plus, Receipt, Trash2, X } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

const BillingAutomationPanel = dynamic(
  () =>
    import('@/components/billing-automation-panel').then((m) => ({
      default: m.BillingAutomationPanel,
    })),
  { loading: () => null },
);

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'neutral' | 'info' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  VOID: 'neutral',
  OVERDUE: 'danger',
};

const STATUS_FILTERS: { value: '' | InvoiceStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ISSUED', label: 'Awaiting payment' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PARTIAL', label: 'Partly paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Cancelled' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

type FeeLine = {
  id: string;
  code: string;
  description: string;
  formula: string;
  unitPrice: string;
  quantity: string;
};

let feeLineSeq = 0;
const nextFeeLineId = () => `fee-${++feeLineSeq}`;

const emptyFeeLine = (): FeeLine => ({
  id: nextFeeLineId(),
  code: '',
  description: '',
  formula: '',
  unitPrice: '',
  quantity: '1',
});

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type UnitRow = {
  id: string;
  identifier: string;
  block?: { name?: string } | null;
};

function unitBillingSummary(invoices: Invoice[]) {
  const open = invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOID');
  const outstanding = open.reduce((s, i) => s + invoiceOutstanding(i), 0);
  let worst: InvoiceStatus | null = null;
  for (const inv of invoices) {
    if (inv.status === 'OVERDUE') {
      worst = 'OVERDUE';
      break;
    }
    if (inv.status === 'PARTIAL') worst = 'PARTIAL';
    else if (inv.status === 'ISSUED' && worst !== 'PARTIAL') worst = 'ISSUED';
  }
  return { total: invoices.length, openCount: open.length, outstanding, worst };
}

function UnitInvoicesTable({
  items,
  selectedId,
  onSelect,
}: {
  items: Invoice[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No invoices for this unit"
        description="Generate monthly invoices or add a one-off charge for this unit."
      />
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase sr-muted border-b border-[rgb(var(--sr-border))]">
          <tr>
            <th className="py-3 px-4">Number</th>
            <th className="px-2">Period</th>
            <th className="px-2">Due</th>
            <th className="px-2 text-right">Total</th>
            <th className="px-2 text-right">Outstanding</th>
            <th className="px-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--sr-border))]">
          {items.map((inv) => (
            <tr
              key={inv.id}
              tabIndex={0}
              className={`cursor-pointer transition-colors hover:bg-[rgb(var(--sr-bg))]/60 ${
                selectedId === inv.id ? 'bg-[rgb(var(--sr-coral)/0.06)]' : ''
              }`}
              onClick={() => onSelect(selectedId === inv.id ? null : inv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(selectedId === inv.id ? null : inv.id);
                }
              }}
            >
              <td className="py-3 px-4 font-mono text-xs">{inv.number}</td>
              <td className="px-2 sr-muted text-xs">
                {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
              </td>
              <td className="px-2 sr-muted">{fmtDate(inv.dueDate)}</td>
              <td className="px-2 text-right">{formatMoney(inv.total, inv.currencyCode)}</td>
              <td className="px-2 text-right">
                {formatMoney(invoiceOutstanding(inv), inv.currencyCode)}
              </td>
              <td className="px-2">
                <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type BillingMode = 'schedule' | 'flat';

function GenerateCycleForm({ condoId, onDone }: { condoId: string; onDone: () => void }) {
  const generate = useGenerateRecurringInvoices(api);
  const [mode, setMode] = React.useState<BillingMode>('schedule');
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [lines, setLines] = React.useState<FeeLine[]>(() => [
    { ...emptyFeeLine(), code: 'MAINT', description: 'Monthly maintenance fee' },
  ]);

  function updateLine(i: number, patch: Partial<FeeLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd || !dueDate) {
      toast.error('Set the period and due date');
      return;
    }

    let cleaned: ReturnType<typeof toLine>[] | undefined;
    function toLine(l: FeeLine) {
      return {
        code: l.code.trim() || 'FEE',
        description: l.description.trim(),
        formula: l.formula.trim() || undefined,
        unitPrice: Number(l.unitPrice),
        quantity: l.quantity === '' ? 1 : Number(l.quantity),
      };
    }
    if (mode === 'flat') {
      cleaned = lines.filter((l) => l.description.trim() && l.unitPrice !== '').map(toLine);
      if (cleaned.length === 0) {
        toast.error('Add at least one fee line with an amount');
        return;
      }
    }
    const confirmMsg =
      mode === 'schedule'
        ? `Generate invoices for ${periodStart} to ${periodEnd} using each unit's fee schedule, including active additional charges? Units with no billable lines will be skipped.`
        : `Generate invoices for ${periodStart} to ${periodEnd} using ${cleaned?.length ?? 0} flat line(s) for every unit?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await generate.mutateAsync({
        condoId,
        input: {
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          // Omit lines to auto-compute each unit's fee from its unit-type rate.
          lines: cleaned,
        },
      });
      const parts = [`Generated ${res.created} invoice${res.created === 1 ? '' : 's'}`];
      if (res.skipped) parts.push(`${res.skipped} already billed`);
      if (res.skippedNoRate) parts.push(`${res.skippedNoRate} skipped — no fee rate set`);
      toast.success(parts.join(' · '));
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="!p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold">Generate monthly invoices</h3>
          <p className="sr-muted text-sm mt-1">
            Issues one invoice per unit for the period. Units already billed for the same start date
            are skipped, so re-running is safe.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={onDone}>
          <X className="size-4" />
        </Button>
      </div>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <fieldset className="flex flex-col gap-2">
          <Label>How to charge</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                mode === 'schedule'
                  ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.06)]'
                  : 'border-[rgb(var(--sr-border))]'
              }`}
            >
              <input
                type="radio"
                name="billing-mode"
                className="mt-1"
                checked={mode === 'schedule'}
                onChange={() => setMode('schedule')}
              />
              <span className="text-sm">
                <span className="font-medium">Use each unit's fee schedule</span>
                <span className="block sr-muted text-xs mt-0.5">
                  Auto-computes maintenance, sinking fund and active additional charges from
                  Settings → Billing &amp; receipts.
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                mode === 'flat'
                  ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.06)]'
                  : 'border-[rgb(var(--sr-border))]'
              }`}
            >
              <input
                type="radio"
                name="billing-mode"
                className="mt-1"
                checked={mode === 'flat'}
                onChange={() => setMode('flat')}
              />
              <span className="text-sm">
                <span className="font-medium">Same lines for every unit</span>
                <span className="block sr-muted text-xs mt-0.5">
                  Charge one fixed set of fee lines to all selected units.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-start">Period start</Label>
            <input
              id="period-start"
              type="date"
              className={selectCls}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-end">Period end</Label>
            <input
              id="period-end"
              type="date"
              className={selectCls}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="due-date">Due date</Label>
            <input
              id="due-date"
              type="date"
              className={selectCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </section>

        {mode === 'schedule' ? (
          <p className="text-sm sr-muted rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
            Each unit is charged from its unit-type fee rate plus active additional charges
            configured in <span className="font-medium">Settings → Billing &amp; receipts</span>.
            Units with no billable lines are skipped.
          </p>
        ) : (
          <section className="flex flex-col gap-3">
            <Label>Fee lines</Label>
            {lines.map((line, i) => (
              <div
                key={line.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end rounded-xl border border-[rgb(var(--sr-border))]/70 p-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs sr-muted">Code</span>
                  <Input
                    value={line.code}
                    placeholder="MAINT"
                    onChange={(e) => updateLine(i, { code: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs sr-muted">Description</span>
                  <Input
                    value={line.description}
                    placeholder="Monthly maintenance fee"
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs sr-muted">Amount (MYR)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    placeholder="250.00"
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                  />
                </div>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove line"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <span />
                )}
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <span className="text-xs sr-muted">Formula (optional — shown to residents)</span>
                  <Input
                    value={line.formula}
                    placeholder="e.g. RM0.25/sq ft × 1,000 sq ft"
                    onChange={(e) => updateLine(i, { formula: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
              onClick={() => setLines((prev) => [...prev, emptyFeeLine()])}
            >
              <Plus className="size-4" />
              Add line
            </button>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-[rgb(var(--sr-border))]/70">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={generate.isPending}>
            {generate.isPending ? 'Generating…' : 'Generate invoices'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EInvoicePanel({ invoiceId, canManage }: { invoiceId: string; canManage: boolean }) {
  const ei = useEInvoice(api, invoiceId);
  const submit = useSubmitEInvoice(api);
  const cancel = useCancelEInvoice(api);
  const data = ei.data;
  const status = data?.status ?? 'NOT_SUBMITTED';
  const canSubmit = status !== 'VALID' && status !== 'PENDING';

  async function onSubmit() {
    if (!window.confirm('Build and submit this invoice to LHDN MyInvois?')) return;
    try {
      const res = await submit.mutateAsync({ invoiceId });
      toast[res.status === 'VALID' ? 'success' : 'error'](
        res.status === 'VALID'
          ? 'E-invoice validated by LHDN'
          : `E-invoice rejected: ${res.errorMessage ?? 'validation failed'}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onCancel() {
    const reason = window.prompt('Reason for cancelling this e-invoice?') ?? undefined;
    if (reason === undefined) return;
    try {
      await cancel.mutateAsync({ invoiceId, input: { reason } });
      toast.success('E-invoice cancelled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-5 pt-4 border-t border-[rgb(var(--sr-border))]/70">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">LHDN e-invoice</p>
        {ei.isLoading ? (
          <span className="text-xs sr-muted">Loading…</span>
        ) : (
          <Badge tone={eInvoiceStatusTone(status)}>{EINVOICE_STATUS_LABELS[status]}</Badge>
        )}
      </div>

      {data?.lhdnUuid ? (
        <div className="mt-2 text-xs sr-muted flex flex-col gap-0.5">
          <span>
            UUID: <span className="font-mono">{data.lhdnUuid}</span>
          </span>
          {data.validationUrl ? (
            <a
              href={data.validationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[rgb(var(--sr-coral))] hover:underline break-all"
            >
              Verify on MyInvois
            </a>
          ) : null}
        </div>
      ) : null}

      {data?.errorMessage ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{data.errorMessage}</p>
      ) : null}

      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canSubmit ? (
            <Button size="sm" disabled={submit.isPending} onClick={onSubmit}>
              {submit.isPending
                ? 'Submitting…'
                : status === 'NOT_SUBMITTED'
                  ? 'Submit to LHDN'
                  : 'Retry submission'}
            </Button>
          ) : null}
          {status === 'VALID' ? (
            <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={onCancel}>
              Cancel e-invoice
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InvoiceDetail({
  invoice,
  canManageEInvoice,
  onClose,
}: {
  invoice: Invoice;
  canManageEInvoice: boolean;
  onClose: () => void;
}) {
  const recordPayment = useRecordManualPayment(api);
  const voidInvoice = useVoidInvoice(api);
  const outstanding = invoiceOutstanding(invoice);
  const settleable = invoice.status !== 'PAID' && invoice.status !== 'VOID';
  const paymentHistory = visibleInvoicePayments(invoice.payments ?? []);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('CASH');
  const [reference, setReference] = React.useState('');

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const paymentAmount = amount === '' ? outstanding : Number(amount);
    if (
      !window.confirm(
        `Record ${formatMoney(paymentAmount, invoice.currencyCode)} ${method} payment for ${invoice.number}?`,
      )
    ) {
      return;
    }
    try {
      await recordPayment.mutateAsync({
        id: invoice.id,
        input: {
          amount: amount === '' ? undefined : Number(amount),
          method,
          reference: reference.trim() || undefined,
        },
      });
      toast.success('Payment recorded');
      setAmount('');
      setReference('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onVoid() {
    if (!window.confirm(`Void invoice ${invoice.number}? This cannot be undone.`)) return;
    try {
      await voidInvoice.mutateAsync({ id: invoice.id });
      toast.success('Invoice voided');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="!p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold font-mono">{invoice.number}</h3>
            <Badge tone={STATUS_TONE[invoice.status]}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
          </div>
          <p className="sr-muted text-sm mt-1">
            {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)} · due{' '}
            {fmtDate(invoice.dueDate)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {invoice.lines?.length ? (
        <table className="w-full text-sm mb-4">
          <thead className="text-left sr-muted text-xs uppercase">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2">Formula</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--sr-border))]">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2.5">
                  <div className="font-medium">{l.description}</div>
                  <div className="text-xs sr-muted">{l.code}</div>
                </td>
                <td className="py-2.5 sr-muted text-xs">{l.formula ?? '—'}</td>
                <td className="py-2.5 text-right font-medium">
                  {formatMoney(l.amount, invoice.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="rounded-xl bg-[rgb(var(--sr-bg))]/60 border border-[rgb(var(--sr-border))]/70 p-4 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span className="sr-muted">Total</span>
          <span className="font-medium">{formatMoney(invoice.total, invoice.currencyCode)}</span>
        </div>
        <div className="flex justify-between">
          <span className="sr-muted">Paid</span>
          <span className="font-medium">
            {formatMoney(invoice.amountPaid, invoice.currencyCode)}
          </span>
        </div>
        <div className="flex justify-between border-t border-[rgb(var(--sr-border))]/70 pt-1.5">
          <span className="font-semibold">Outstanding</span>
          <span className="font-semibold">{formatMoney(outstanding, invoice.currencyCode)}</span>
        </div>
      </div>

      {paymentHistory.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase sr-muted font-semibold mb-2">Payments</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {paymentHistory.map((p) => (
              <li key={p.id} className="flex justify-between items-center">
                <span>
                  {formatMoney(p.amount, p.currencyCode)}{' '}
                  <span className="sr-muted">· {p.provider.toLowerCase()}</span>
                </span>
                <Badge tone={paymentStatusTone(p.status)}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <EInvoicePanel invoiceId={invoice.id} canManage={canManageEInvoice} />

      {settleable ? (
        <form
          className="mt-5 pt-4 border-t border-[rgb(var(--sr-border))]/70 flex flex-col gap-3"
          onSubmit={submitPayment}
        >
          <p className="text-sm font-medium">Record a manual payment</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs sr-muted">Amount (default: full)</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                placeholder={String(outstanding.toFixed(2))}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs sr-muted">Method</span>
              <select
                className={selectCls}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs sr-muted">Reference</span>
              <Input
                value={reference}
                placeholder="Receipt / txn no."
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending ? 'Recording…' : 'Record payment'}
            </Button>
            <Button type="button" variant="ghost" disabled={voidInvoice.isPending} onClick={onVoid}>
              Void invoice
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

export default function AdminInvoicesPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const condoId = condo?.id ?? null;

  const qc = useQueryClient();
  const me = useMe(api);
  const cachedMe = qc.getQueryData(queryKeys.me) as { abilities?: AbilityRule[] } | undefined;
  const abilities = (cachedMe?.abilities ??
    (me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];
  const canManageEInvoice = hasAbility(abilities, 'manage', 'EInvoice');

  const [status, setStatus] = React.useState<'' | InvoiceStatus>('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [selectedUnitId, setSelectedUnitId] = React.useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [unitSearch, setUnitSearch] = React.useState('');

  const units = useCondoUnitsSearch(api, condoId, unitSearch);
  const unitRows = (units.data?.items ?? []) as UnitRow[];

  const condoInvoices = useCondoInvoices(api, condoId, status || undefined);
  const unitInvoices = useUnitInvoices(api, selectedUnitId);
  const sweep = useRunInvoiceDueSweep(api);

  const allInvoices = (condoInvoices.data?.items ?? []) as Invoice[];
  const invoicesByUnit = React.useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of allInvoices) {
      const list = map.get(inv.unitId) ?? [];
      list.push(inv);
      map.set(inv.unitId, list);
    }
    return map;
  }, [allInvoices]);

  const selectedUnit = unitRows.find((u) => u.id === selectedUnitId) ?? null;
  const unitInvoiceItems = React.useMemo(() => {
    const items = (unitInvoices.data?.items ?? []) as Invoice[];
    if (!status) return items;
    return items.filter((i) => i.status === status);
  }, [unitInvoices.data?.items, status]);

  const selectedInvoice =
    unitInvoiceItems.find((i) => i.id === selectedInvoiceId) ??
    allInvoices.find((i) => i.id === selectedInvoiceId) ??
    null;

  React.useEffect(() => {
    if (selectedInvoiceId && !unitInvoiceItems.some((i) => i.id === selectedInvoiceId)) {
      setSelectedInvoiceId(null);
    }
  }, [unitInvoiceItems, selectedInvoiceId]);

  async function onSweep() {
    if (!condoId) return;
    if (
      !window.confirm(
        'Check for overdue invoices now? This marks unpaid invoices as overdue and prepares payment reminders.',
      )
    ) {
      return;
    }
    try {
      const res = await sweep.mutateAsync({ condoId });
      toast.success(
        `Marked ${res.overdue} overdue · ${res.dueSoonNotified} reminder${res.dueSoonNotified === 1 ? '' : 's'} sent`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function openUnit(unitId: string) {
    setSelectedUnitId(unitId);
    setSelectedInvoiceId(null);
  }

  function backToUnits() {
    setSelectedUnitId(null);
    setSelectedInvoiceId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="sr-muted">
            {selectedUnit
              ? `Billing for unit ${selectedUnit.identifier} — select an invoice for details.`
              : 'Browse by unit, then open invoices to record payments or void.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!condoId || sweep.isPending} onClick={onSweep}>
            <CalendarClock className="size-4" />
            {sweep.isPending ? 'Checking…' : 'Check overdue invoices'}
          </Button>
          <Button disabled={!condoId} onClick={() => setComposeOpen((v) => !v)}>
            <Receipt className="size-4" />
            Generate monthly invoices
          </Button>
        </div>
      </header>

      {condoId ? <BillingAutomationPanel condoId={condoId} /> : null}

      {composeOpen && condoId ? (
        <GenerateCycleForm condoId={condoId} onDone={() => setComposeOpen(false)} />
      ) : null}

      {selectedUnit ? (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="font-medium text-[rgb(var(--sr-coral))] hover:underline"
            onClick={backToUnits}
          >
            All units
          </button>
          <ChevronRight className="size-4 sr-muted" />
          <span className="font-semibold">{selectedUnit.identifier}</span>
          {selectedUnit.block?.name ? (
            <span className="sr-muted">· {selectedUnit.block.name}</span>
          ) : null}
        </div>
      ) : null}

      {selectedInvoice ? (
        <InvoiceDetail
          invoice={selectedInvoice}
          canManageEInvoice={canManageEInvoice}
          onClose={() => setSelectedInvoiceId(null)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
              status === f.value
                ? 'border-[rgb(var(--sr-coral)/0.55)] bg-[rgb(var(--sr-coral)/0.08)] text-[rgb(var(--sr-coral))]'
                : 'border-[rgb(var(--sr-border))] hover:border-[rgb(var(--sr-coral)/0.3)] sr-muted'
            }`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedUnitId ? (
        unitInvoices.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <UnitInvoicesTable
            items={unitInvoiceItems}
            selectedId={selectedInvoiceId}
            onSelect={setSelectedInvoiceId}
          />
        )
      ) : units.isLoading || condoInvoices.isLoading ? (
        <Skeleton className="h-96" />
      ) : unitRows.length === 0 ? (
        <EmptyState
          title="No units"
          description="Add units to the condo before issuing invoices."
        />
      ) : (
        <>
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search unit number…"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
            />
          </div>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase sr-muted border-b border-[rgb(var(--sr-border))]">
                <tr>
                  <th className="py-3 px-4">Unit</th>
                  <th className="px-2">Block</th>
                  <th className="px-2 text-right">Invoices</th>
                  <th className="px-2 text-right">Outstanding</th>
                  <th className="px-2">Billing</th>
                  <th className="px-2 w-10" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--sr-border))]">
                {unitRows.map((unit) => {
                  const summary = unitBillingSummary(invoicesByUnit.get(unit.id) ?? []);
                  return (
                    <tr
                      key={unit.id}
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-[rgb(var(--sr-bg))]/60"
                      onClick={() => openUnit(unit.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openUnit(unit.id);
                        }
                      }}
                    >
                      <td className="py-3 px-4 font-medium">{unit.identifier}</td>
                      <td className="px-2 sr-muted">{unit.block?.name ?? '—'}</td>
                      <td className="px-2 text-right sr-muted">
                        {summary.total === 0 ? '—' : `${summary.openCount} open / ${summary.total}`}
                      </td>
                      <td className="px-2 text-right font-medium">
                        {summary.outstanding > 0 ? formatMoney(summary.outstanding, 'MYR') : '—'}
                      </td>
                      <td className="px-2">
                        {summary.worst ? (
                          <Badge tone={STATUS_TONE[summary.worst]}>
                            {INVOICE_STATUS_LABELS[summary.worst]}
                          </Badge>
                        ) : summary.total > 0 ? (
                          <Badge tone="success">Paid up</Badge>
                        ) : (
                          <span className="sr-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 sr-muted">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
