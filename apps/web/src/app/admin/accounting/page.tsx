'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useApproveReviewedPayment,
  useArrearsAging,
  useCollectionsSummary,
  useCondoReceipts,
  useCondoUnitsSearch,
  useDismissPayment,
  useFundBalances,
  useMyCondos,
  usePaymentIssues,
  useRecordPrepayment,
  useUnitStatement,
} from '@smartresidence/api-client';
import type { PaymentIssue, ReceiptKind, UnitStatement } from '@smartresidence/shared-types';
import {
  ARREARS_BUCKET_LABELS,
  FUND_LABELS,
  PAYMENT_REVIEW_REASON_LABELS,
  PAYMENT_STATUS_LABELS,
  RECEIPT_KIND_LABELS,
  formatCompactUnitLabel,
  formatMoney,
  paymentStatusTone,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

const selectCls = 'sr-select';

type UnitRow = {
  id: string;
  identifier: string;
  block?: { name?: string } | null;
  ownerships?: Array<{ user?: { id: string; name: string } | null }>;
};

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadReceipt(receiptId: string, number: string) {
  try {
    const blob = await api.downloadReceiptPdf(receiptId);
    await downloadBlob(blob, `${number}.pdf`);
  } catch (err) {
    toast.error((err as Error).message);
  }
}

function PrepaymentForm({ condoId }: { condoId: string }) {
  const record = useRecordPrepayment(api);
  const [search, setSearch] = React.useState('');
  const units = useCondoUnitsSearch(api, condoId, search);
  const unitItems = (units.data?.items ?? []) as UnitRow[];
  const [unitId, setUnitId] = React.useState('');
  const [amount, setAmount] = React.useState('');

  const ownerId = unitItems.find((u) => u.id === unitId)?.ownerships?.[0]?.user?.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || amount === '' || Number(amount) <= 0) {
      toast.error('Pick a unit and enter an amount');
      return;
    }
    const unit = unitItems.find((u) => u.id === unitId);
    const unitLabel = unit ? formatCompactUnitLabel(unit) : 'this unit';
    if (
      !window.confirm(
        `Record an advance payment of ${formatMoney(Number(amount))} for unit ${unitLabel}?`,
      )
    ) {
      return;
    }
    try {
      const res = await record.mutateAsync({ unitId, userId: ownerId, amount: Number(amount) });
      toast.success(`Prepayment recorded — credit now ${formatMoney(res.credit)}`);
      setAmount('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <h3 className="font-semibold mb-1 text-sm">Record advance maintenance payment</h3>
      <p className="text-xs sr-muted mb-4">
        Adds credit to the unit account. Credit is applied to outstanding invoices first, then
        future maintenance fees. A receipt is issued.
      </p>
      <form className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end" onSubmit={submit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pp-search">Find unit</Label>
          <Input
            id="pp-search"
            value={search}
            placeholder="Search…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pp-unit">Unit</Label>
          <select
            id="pp-unit"
            className={selectCls}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">Select…</option>
            {unitItems.map((u) => (
              <option key={u.id} value={u.id}>
                {formatCompactUnitLabel(u)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pp-amount">Amount (MYR)</Label>
          <Input
            id="pp-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={record.isPending}>
          {record.isPending ? 'Recording…' : 'Record prepayment'}
        </Button>
      </form>
    </Card>
  );
}

function PaymentIssuesPanel({ condoId }: { condoId: string }) {
  const issues = usePaymentIssues(api, condoId);
  const dismiss = useDismissPayment(api, condoId);
  const approve = useApproveReviewedPayment(api, condoId);

  async function onDismiss(item: PaymentIssue) {
    if (
      !window.confirm(
        `Dismiss ${item.provider} payment issue for ${item.invoiceNumber}? Confirm this is reconciled or not collectible before hiding it.`,
      )
    ) {
      return;
    }
    try {
      await dismiss.mutateAsync(item.id);
      toast.success('Payment attempt dismissed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onApprove(item: PaymentIssue) {
    const msg =
      item.reviewReason === 'AMOUNT_MISMATCH'
        ? `Approve settlement of ${formatMoney(item.amount)} even though the gateway reported ${formatMoney(item.reportedAmount ?? 0)}?`
        : 'Approve this flagged payment and settle the invoice?';
    if (!window.confirm(msg)) return;
    try {
      await approve.mutateAsync(item.id);
      toast.success('Payment approved and invoice updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const busy = dismiss.isPending || approve.isPending;

  return (
    <Card>
      <h3 className="font-semibold mb-1 text-sm">Payment issues</h3>
      <p className="text-xs sr-muted mb-4">
        Failed gateway attempts and payments held for review (e.g. amount mismatch). Dismiss clutter
        or approve after verifying with your gateway dashboard.
      </p>
      {issues.isLoading ? (
        <Skeleton className="h-24" />
      ) : (issues.data?.length ?? 0) === 0 ? (
        <p className="text-sm sr-muted">No payment issues — all clear.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-xs sr-muted border-b border-[rgb(var(--sr-border))]/70">
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Invoice</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Unit</th>
                <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Amount</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Provider</th>
                <th className="pb-2 pr-3 font-medium text-center whitespace-nowrap">Status</th>
                <th className="pb-2 pr-3 font-medium">Issue</th>
                <th className="pb-2 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(issues.data ?? []).map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[rgb(var(--sr-border))]/40 last:border-0 align-middle"
                >
                  <td className="py-3 pr-3 align-middle font-mono text-xs whitespace-nowrap">
                    <Link className="hover:underline" href="/admin/invoices">
                      {item.invoiceNumber}
                    </Link>
                    <span className="block sr-muted mt-0.5">{fmtDateTime(item.createdAt)}</span>
                  </td>
                  <td className="py-3 pr-3 align-middle whitespace-nowrap">
                    {item.unitIdentifier}
                  </td>
                  <td className="py-3 pr-3 align-middle text-right font-medium tabular-nums whitespace-nowrap">
                    {formatMoney(item.amount)}
                  </td>
                  <td className="py-3 pr-3 align-middle text-xs">
                    <span className="font-medium">{item.provider}</span>
                    {item.providerRef ? (
                      <span className="block sr-muted font-mono mt-0.5">{item.providerRef}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 align-middle text-center whitespace-nowrap">
                    <Badge tone={paymentStatusTone(item.status)}>
                      {PAYMENT_STATUS_LABELS[item.status]}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 align-middle text-xs">
                    {item.reviewReason ? (
                      <span>
                        {PAYMENT_REVIEW_REASON_LABELS[item.reviewReason] ?? item.reviewReason}
                        {item.reportedAmount != null ? (
                          <span className="block sr-muted mt-0.5">
                            Gateway {formatMoney(item.reportedAmount)} vs expected{' '}
                            {formatMoney(item.expectedAmount ?? item.amount)}
                          </span>
                        ) : null}
                      </span>
                    ) : item.gatewayStatus ? (
                      <span className="sr-muted">Gateway: {item.gatewayStatus}</span>
                    ) : (
                      <span className="sr-muted">Failed attempt</span>
                    )}
                  </td>
                  <td className="py-3 align-middle text-right whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.reviewReason ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onApprove(item)}
                        >
                          Approve
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onDismiss(item)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReceiptRegister({ condoId }: { condoId: string }) {
  const [kind, setKind] = React.useState<'' | ReceiptKind>('');
  const receipts = useCondoReceipts(api, condoId, kind || undefined);
  const rows = receipts.data?.items ?? [];

  return (
    <Card>
      <div className="flex flex-col gap-4 mb-4">
        <div>
          <h3 className="font-semibold mb-1 text-sm">Receipt register</h3>
          <p className="text-xs sr-muted">
            Official receipt trail for payments, deposits and refunds. Use this for resident queries
            and auditor follow-up.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-bg))]/45 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="receipt-kind" className="text-xs font-semibold uppercase sr-muted">
              Receipt type
            </Label>
            <select
              id="receipt-kind"
              className={`${selectCls} h-10 min-w-44`}
              value={kind}
              onChange={(e) => setKind(e.target.value as '' | ReceiptKind)}
            >
              <option value="">All</option>
              {Object.entries(RECEIPT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-full sm:w-auto"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv('receipt-register.csv', [
                ['Number', 'Type', 'Issued at', 'Unit', 'Issued to', 'Amount', 'Description'],
                ...rows.map((r) => [
                  r.number,
                  RECEIPT_KIND_LABELS[r.kind],
                  fmtDate(r.issuedAt),
                  r.unit?.identifier ?? '',
                  r.issuedTo?.name ?? '',
                  String(r.amount),
                  r.description ?? '',
                ]),
              ])
            }
          >
            Export CSV
          </Button>
        </div>
      </div>

      {receipts.isLoading ? (
        <Skeleton className="h-28" />
      ) : rows.length === 0 ? (
        <p className="text-sm sr-muted">No receipts found for this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs sr-muted border-b border-[rgb(var(--sr-border))]/70">
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Receipt</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Type</th>
                <th className="pb-2 pr-3 font-medium">Unit / Payee</th>
                <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Amount</th>
                <th className="pb-2 font-medium text-right whitespace-nowrap">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[rgb(var(--sr-border))]/40 last:border-0 align-middle"
                >
                  <td className="py-3 pr-3 align-middle whitespace-nowrap">
                    <span className="font-mono text-xs">{r.number}</span>
                    <span className="block sr-muted text-xs mt-0.5">{fmtDate(r.issuedAt)}</span>
                  </td>
                  <td className="py-3 pr-3 align-middle whitespace-nowrap">
                    {RECEIPT_KIND_LABELS[r.kind]}
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <span>{r.unit?.identifier ?? '—'}</span>
                    {r.issuedTo?.name ? (
                      <span className="block sr-muted text-xs mt-0.5">{r.issuedTo.name}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 align-middle text-right font-medium tabular-nums whitespace-nowrap">
                    {formatMoney(r.amount, r.currencyCode)}
                  </td>
                  <td className="py-3 align-middle text-right whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadReceipt(r.id, r.number)}
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 25 ? (
            <p className="text-xs sr-muted mt-2">Showing latest 25 of {rows.length} receipts.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function UnitStatementPanel({ condoId }: { condoId: string }) {
  const [search, setSearch] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [stmtFrom, setStmtFrom] = React.useState(monthStartIso);
  const [stmtTo, setStmtTo] = React.useState(todayIso);
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const units = useCondoUnitsSearch(api, condoId, search);
  const unitItems = (units.data?.items ?? []) as UnitRow[];
  const statement = useUnitStatement(api, unitId || null);
  const selectedUnit = unitItems.find((u) => u.id === unitId);
  const data = statement.data as UnitStatement | null | undefined;

  async function exportPdf() {
    if (!unitId) return;
    setExportingPdf(true);
    try {
      const blob = await api.downloadUnitStatementPdf(condoId, unitId, {
        from: stmtFrom,
        to: stmtTo,
      });
      const label = selectedUnit?.identifier ?? unitId;
      await downloadBlob(blob, `statement-${label}-${stmtFrom}.pdf`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingPdf(false);
    }
  }

  function exportCsv() {
    if (!data?.entries.length) return;
    const fromMs = new Date(stmtFrom).getTime();
    const toMs = new Date(stmtTo).getTime() + 86_400_000 - 1;
    const filtered = data.entries.filter((e) => {
      const t = new Date(e.occurredAt).getTime();
      return t >= fromMs && t <= toMs;
    });
    if (filtered.length === 0) {
      toast.error('No statement entries in this date range');
      return;
    }
    downloadCsv(`unit-statement-${selectedUnit?.identifier ?? unitId}.csv`, [
      ['From', stmtFrom],
      ['To', stmtTo],
      ['Date', 'Type', 'Fund', 'Description', 'Charge', 'Payment', 'Balance'],
      ...filtered.map((e) => [
        fmtDate(e.occurredAt),
        e.type,
        FUND_LABELS[e.fund],
        e.description,
        String(e.charge),
        String(e.payment),
        String(e.balance),
      ]),
    ]);
  }

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold mb-1 text-sm">Unit statement</h3>
          <p className="text-xs sr-muted">
            Running balance by unit. Charges increase the balance, payments and credits reduce it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="stmt-from" className="text-xs">
              From
            </Label>
            <Input
              id="stmt-from"
              type="date"
              className="h-8 text-xs"
              value={stmtFrom}
              onChange={(e) => setStmtFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="stmt-to" className="text-xs">
              To
            </Label>
            <Input
              id="stmt-to"
              type="date"
              className="h-8 text-xs"
              value={stmtTo}
              onChange={(e) => setStmtTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!unitId || exportingPdf}
            onClick={() => exportPdf()}
          >
            {exportingPdf ? 'Exporting…' : 'PDF'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!data?.entries.length}
            onClick={() => exportCsv()}
          >
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stmt-search">Find unit</Label>
          <Input
            id="stmt-search"
            value={search}
            placeholder="Search unit..."
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stmt-unit">Unit</Label>
          <select
            id="stmt-unit"
            className={selectCls}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">Select...</option>
            {unitItems.map((u) => (
              <option key={u.id} value={u.id}>
                {formatCompactUnitLabel(u)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!unitId ? (
        <p className="text-sm sr-muted">Select a unit to view its charges, payments and credits.</p>
      ) : statement.isLoading ? (
        <Skeleton className="h-32" />
      ) : !data ? (
        <p className="text-sm sr-muted">No statement available.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs uppercase sr-muted font-semibold">Outstanding</div>
              <div className="text-xl font-bold mt-1">{formatMoney(data.totalOutstanding)}</div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--sr-border))]/70 p-3">
              <div className="text-xs uppercase sr-muted font-semibold">Advance credit</div>
              <div className="text-xl font-bold mt-1">{formatMoney(data.creditBalance)}</div>
            </div>
          </section>
          {data.entries.length === 0 ? (
            <p className="text-sm sr-muted">No ledger entries for this unit yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs sr-muted border-b border-[rgb(var(--sr-border))]/70">
                    <th className="pb-2 pr-3 font-medium whitespace-nowrap">Date</th>
                    <th className="pb-2 pr-3 font-medium">Description</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Charge</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Payment</th>
                    <th className="pb-2 font-medium text-right whitespace-nowrap">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.slice(-20).map((e, idx) => (
                    <tr
                      key={`${e.occurredAt}-${idx}`}
                      className="border-b border-[rgb(var(--sr-border))]/40 last:border-0 align-middle"
                    >
                      <td className="py-3 pr-3 align-middle whitespace-nowrap">
                        {fmtDate(e.occurredAt)}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <span>{e.description}</span>
                        <span className="block sr-muted text-xs mt-0.5">
                          {FUND_LABELS[e.fund]} · {e.type}
                        </span>
                      </td>
                      <td className="py-3 pr-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {e.charge ? formatMoney(e.charge) : '—'}
                      </td>
                      <td className="py-3 pr-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {e.payment ? formatMoney(e.payment) : '—'}
                      </td>
                      <td className="py-3 align-middle text-right font-medium tabular-nums whitespace-nowrap">
                        {formatMoney(e.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.entries.length > 20 ? (
                <p className="text-xs sr-muted mt-2">
                  Showing latest 20 of {data.entries.length} statement entries.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminAccountingPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const funds = useFundBalances(api, condoId);
  const [collectionFrom, setCollectionFrom] = React.useState(monthStartIso);
  const [collectionTo, setCollectionTo] = React.useState(todayIso);
  const [exportingCollections, setExportingCollections] = React.useState(false);
  const [exportingArrears, setExportingArrears] = React.useState(false);
  const collections = useCollectionsSummary(api, condoId, {
    from: collectionFrom,
    to: collectionTo,
  });
  const arrears = useArrearsAging(api, condoId);

  async function exportCollectionsCsv() {
    if (!condoId) return;
    setExportingCollections(true);
    try {
      const blob = await api.downloadCollectionsCsv(condoId, {
        from: collectionFrom,
        to: collectionTo,
      });
      await downloadBlob(blob, `collections-${collectionFrom}-${collectionTo}.csv`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingCollections(false);
    }
  }

  async function exportArrearsCsv() {
    if (!condoId) return;
    setExportingArrears(true);
    try {
      const blob = await api.downloadArrearsCsv(condoId);
      await downloadBlob(blob, `arrears-aging-${todayIso()}.csv`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingArrears(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
        <p className="sr-muted">
          See fund balances, money collected, and unpaid invoices — maintenance and sinking fund
          kept separate.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {funds.isLoading
          ? ['a', 'b', 'c', 'd'].map((k) => <Skeleton key={k} className="h-24" />)
          : (funds.data ?? []).map((f) => (
              <Card key={f.fund}>
                <div className="text-xs uppercase sr-muted font-semibold">
                  {FUND_LABELS[f.fund]}
                </div>
                <div className="text-2xl font-bold mt-1">{formatMoney(f.balance)}</div>
              </Card>
            ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sm">Collections</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="col-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="col-from"
                  type="date"
                  className="h-8 text-xs"
                  value={collectionFrom}
                  onChange={(e) => setCollectionFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="col-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="col-to"
                  type="date"
                  className="h-8 text-xs"
                  value={collectionTo}
                  onChange={(e) => setCollectionTo(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!condoId || exportingCollections}
                onClick={() => exportCollectionsCsv()}
              >
                {exportingCollections ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          </div>
          {collections.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between border-b border-[rgb(var(--sr-border))]/70 pb-2">
                <span className="sr-muted">
                  Total collected · {collections.data?.count ?? 0} payment(s)
                </span>
                <span className="font-semibold">{formatMoney(collections.data?.total ?? 0)}</span>
              </div>
              {(collections.data?.byFund ?? []).map((f) => (
                <div key={f.fund} className="flex justify-between">
                  <span className="sr-muted">{FUND_LABELS[f.fund]}</span>
                  <span>{formatMoney(f.balance)}</span>
                </div>
              ))}
              {(collections.data?.byFund.length ?? 0) === 0 ? (
                <p className="sr-muted">No payments collected in this period.</p>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sm">Unpaid by age</h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!condoId || exportingArrears}
              onClick={() => exportArrearsCsv()}
            >
              {exportingArrears ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          {arrears.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between border-b border-[rgb(var(--sr-border))]/70 pb-2">
                <span className="sr-muted">
                  Outstanding · {arrears.data?.unitsInArrears ?? 0} unit(s)
                  {arrears.data?.invoicesInArrears
                    ? ` · ${arrears.data.invoicesInArrears} invoice(s)`
                    : ''}
                </span>
                <span className="font-semibold">
                  {formatMoney(arrears.data?.totalOutstanding ?? 0)}
                </span>
              </div>
              {(arrears.data?.buckets ?? []).map((b) => (
                <div key={b.bucket} className="flex justify-between">
                  <span className="sr-muted">
                    {ARREARS_BUCKET_LABELS[b.bucket]} · {b.count}
                  </span>
                  <span>{formatMoney(b.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {condoId ? (
        <>
          <PaymentIssuesPanel condoId={condoId} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ReceiptRegister condoId={condoId} />
            <UnitStatementPanel condoId={condoId} />
          </div>
          <PrepaymentForm condoId={condoId} />
        </>
      ) : null}
    </div>
  );
}
