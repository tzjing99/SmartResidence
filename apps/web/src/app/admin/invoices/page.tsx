'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCondoInvoices,
  useGenerateRecurringInvoices,
  useMyCondos,
  useRecordManualPayment,
  useRunInvoiceDueSweep,
  useVoidInvoice,
} from '@smartresidence/api-client';
import type { Invoice, InvoiceStatus } from '@smartresidence/shared-types';
import {
  INVOICE_STATUS_LABELS,
  formatMoney,
  invoiceOutstanding,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { CalendarClock, Plus, Receipt, Trash2, X } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

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
  { value: 'ISSUED', label: 'Issued' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Void' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

type FeeLine = { code: string; description: string; formula: string; unitPrice: string; quantity: string };

const emptyFeeLine = (): FeeLine => ({
  code: '',
  description: '',
  formula: '',
  unitPrice: '',
  quantity: '1',
});

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function GenerateCycleForm({ condoId, onDone }: { condoId: string; onDone: () => void }) {
  const generate = useGenerateRecurringInvoices(api);
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [lines, setLines] = React.useState<FeeLine[]>([
    { code: 'MAINT', description: 'Monthly maintenance fee', formula: '', unitPrice: '', quantity: '1' },
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
    const cleaned = lines
      .filter((l) => l.description.trim() && l.unitPrice !== '')
      .map((l) => ({
        code: l.code.trim() || 'FEE',
        description: l.description.trim(),
        formula: l.formula.trim() || undefined,
        unitPrice: Number(l.unitPrice),
        quantity: l.quantity === '' ? 1 : Number(l.quantity),
      }));
    if (cleaned.length === 0) {
      toast.error('Add at least one fee line with an amount');
      return;
    }
    try {
      const res = await generate.mutateAsync({
        condoId,
        input: {
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          lines: cleaned,
        },
      });
      toast.success(
        `Generated ${res.created} invoice${res.created === 1 ? '' : 's'}` +
          (res.skipped ? ` · ${res.skipped} skipped (already billed)` : ''),
      );
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card className="!p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold">Generate a billing cycle</h3>
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

        <section className="flex flex-col gap-3">
          <Label>Fee lines</Label>
          {lines.map((line, i) => (
            <div
              key={i}
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

function InvoiceDetail({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const recordPayment = useRecordManualPayment(api);
  const voidInvoice = useVoidInvoice(api);
  const outstanding = invoiceOutstanding(invoice);
  const settleable = invoice.status !== 'PAID' && invoice.status !== 'VOID';
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('CASH');
  const [reference, setReference] = React.useState('');

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
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
            <Badge tone={STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
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
          <span className="font-medium">{formatMoney(invoice.amountPaid, invoice.currencyCode)}</span>
        </div>
        <div className="flex justify-between border-t border-[rgb(var(--sr-border))]/70 pt-1.5">
          <span className="font-semibold">Outstanding</span>
          <span className="font-semibold">{formatMoney(outstanding, invoice.currencyCode)}</span>
        </div>
      </div>

      {invoice.payments?.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase sr-muted font-semibold mb-2">Payments</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex justify-between items-center">
                <span>
                  {formatMoney(p.amount, p.currencyCode)}{' '}
                  <span className="sr-muted">· {p.provider.toLowerCase()}</span>
                </span>
                <Badge tone={p.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                  {p.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
              <select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}>
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

  const [status, setStatus] = React.useState<'' | InvoiceStatus>('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const invoices = useCondoInvoices(api, condoId, status || undefined);
  const sweep = useRunInvoiceDueSweep(api);

  const items = (invoices.data?.items ?? []) as Invoice[];
  const selected = items.find((i) => i.id === selectedId) ?? null;

  React.useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  async function onSweep() {
    if (!condoId) return;
    try {
      const res = await sweep.mutateAsync({ condoId });
      toast.success(
        `Marked ${res.overdue} overdue · ${res.dueSoonNotified} reminder${res.dueSoonNotified === 1 ? '' : 's'} sent`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="sr-muted">
            Issue maintenance fees, record payments, and keep overdue accounts visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!condoId || sweep.isPending} onClick={onSweep}>
            <CalendarClock className="size-4" />
            {sweep.isPending ? 'Sweeping…' : 'Run due sweep'}
          </Button>
          <Button disabled={!condoId} onClick={() => setComposeOpen((v) => !v)}>
            <Receipt className="size-4" />
            Generate cycle
          </Button>
        </div>
      </header>

      {composeOpen && condoId ? (
        <GenerateCycleForm condoId={condoId} onDone={() => setComposeOpen(false)} />
      ) : null}

      {selected ? <InvoiceDetail invoice={selected} onClose={() => setSelectedId(null)} /> : null}

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

      {invoices.isLoading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Generate a billing cycle to issue maintenance fees to every unit."
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted border-b border-[rgb(var(--sr-border))]">
              <tr>
                <th className="py-3 px-4">Number</th>
                <th className="px-2">Unit</th>
                <th className="px-2">Due</th>
                <th className="px-2 text-right">Total</th>
                <th className="px-2 text-right">Outstanding</th>
                <th className="px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {items.map((inv) => {
                const unit = (inv as Invoice & { unit?: { identifier?: string } }).unit;
                return (
                  <tr
                    key={inv.id}
                    className={`cursor-pointer transition-colors hover:bg-[rgb(var(--sr-bg))]/60 ${
                      selectedId === inv.id ? 'bg-[rgb(var(--sr-coral)/0.06)]' : ''
                    }`}
                    onClick={() => setSelectedId((prev) => (prev === inv.id ? null : inv.id))}
                  >
                    <td className="py-3 px-4 font-mono text-xs">{inv.number}</td>
                    <td className="px-2">{unit?.identifier ?? '—'}</td>
                    <td className="px-2 sr-muted">{fmtDate(inv.dueDate)}</td>
                    <td className="px-2 text-right">{formatMoney(inv.total, inv.currencyCode)}</td>
                    <td className="px-2 text-right">
                      {formatMoney(invoiceOutstanding(inv), inv.currencyCode)}
                    </td>
                    <td className="px-2">
                      <Badge tone={STATUS_TONE[inv.status]}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
