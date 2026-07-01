'use client';

import dynamic from 'next/dynamic';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useArrearsAging,
  useCollectionsSummary,
  useFundBalances,
  useFundSummary,
  useIncomeExpense,
  useMyCondos,
} from '@smartresidence/api-client';
import { ARREARS_BUCKET_LABELS, FUND_LABELS, formatMoney } from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

const AccountingHeavyPanels = dynamic(
  () => import('./accounting-heavy-panels').then((m) => ({ default: m.AccountingHeavyPanels })),
  { loading: () => <Skeleton className="h-96" /> },
);

function monthStartIso(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function priorPeriod(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const priorEnd = new Date(start.getTime() - 86_400_000);
  const priorStart = new Date(priorEnd.getTime() - (days - 1) * 86_400_000);
  return {
    from: priorStart.toISOString().slice(0, 10),
    to: priorEnd.toISOString().slice(0, 10),
  };
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAccountingPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const funds = useFundBalances(api, condoId);
  const [reportFrom, setReportFrom] = React.useState(monthStartIso);
  const [reportTo, setReportTo] = React.useState(todayIso);
  const prior = React.useMemo(() => priorPeriod(reportFrom, reportTo), [reportFrom, reportTo]);
  const fundSummary = useFundSummary(api, condoId, { from: reportFrom, to: reportTo });
  const priorSummary = useFundSummary(api, condoId, { from: prior.from, to: prior.to });
  const incomeExpense = useIncomeExpense(api, condoId, { from: reportFrom, to: reportTo });
  const collections = useCollectionsSummary(api, condoId, {
    from: reportFrom,
    to: reportTo,
  });
  const arrears = useArrearsAging(api, condoId);
  const [exportingCollections, setExportingCollections] = React.useState(false);
  const [exportingArrears, setExportingArrears] = React.useState(false);
  const [exportingFundPdf, setExportingFundPdf] = React.useState(false);
  const [exportingAudit, setExportingAudit] = React.useState(false);
  const [exportingPlPdf, setExportingPlPdf] = React.useState(false);
  const [exportingPlCsv, setExportingPlCsv] = React.useState(false);
  const [exportingBsPdf, setExportingBsPdf] = React.useState(false);
  const [exportingBsCsv, setExportingBsCsv] = React.useState(false);
  const [balanceSheetAsOf, setBalanceSheetAsOf] = React.useState(todayIso);
  const [statementFund, setStatementFund] = React.useState<string>('');

  async function exportCollectionsCsv() {
    if (!condoId) return;
    setExportingCollections(true);
    try {
      const blob = await api.downloadCollectionsCsv(condoId, {
        from: reportFrom,
        to: reportTo,
      });
      await downloadBlob(blob, `collections-${reportFrom}-${reportTo}.csv`);
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

  async function exportFundSummaryPdf() {
    if (!condoId) return;
    setExportingFundPdf(true);
    try {
      const blob = await api.downloadFundSummaryPdf(condoId, {
        from: reportFrom,
        to: reportTo,
      });
      await downloadBlob(blob, `fund-summary-${reportFrom}.pdf`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingFundPdf(false);
    }
  }

  async function exportAuditTrailCsv() {
    if (!condoId) return;
    setExportingAudit(true);
    try {
      const blob = await api.downloadAuditTrailCsv(condoId, {
        from: reportFrom,
        to: reportTo,
      });
      await downloadBlob(blob, `audit-trail-${reportFrom}.csv`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingAudit(false);
    }
  }

  async function exportProfitLossPdf() {
    if (!condoId) return;
    setExportingPlPdf(true);
    try {
      const blob = await api.downloadProfitLossPdf(condoId, {
        from: reportFrom,
        to: reportTo,
        fund: statementFund || undefined,
      });
      await downloadBlob(blob, `profit-loss-${reportFrom}.pdf`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingPlPdf(false);
    }
  }

  async function exportProfitLossCsv() {
    if (!condoId) return;
    setExportingPlCsv(true);
    try {
      const blob = await api.downloadProfitLossCsv(condoId, {
        from: reportFrom,
        to: reportTo,
        fund: statementFund || undefined,
      });
      await downloadBlob(blob, `profit-loss-${reportFrom}.csv`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingPlCsv(false);
    }
  }

  async function exportBalanceSheetPdf() {
    if (!condoId) return;
    setExportingBsPdf(true);
    try {
      const blob = await api.downloadBalanceSheetPdf(condoId, { asOf: balanceSheetAsOf });
      await downloadBlob(blob, `balance-sheet-${balanceSheetAsOf}.pdf`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingBsPdf(false);
    }
  }

  async function exportBalanceSheetCsv() {
    if (!condoId) return;
    setExportingBsCsv(true);
    try {
      const blob = await api.downloadBalanceSheetCsv(condoId, { asOf: balanceSheetAsOf });
      await downloadBlob(blob, `balance-sheet-${balanceSheetAsOf}.csv`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingBsCsv(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
        <p className="sr-muted">
          Fund balances, collections, and arrears for your JMB — maintenance account, sinking fund,
          and deposits are kept separate for Strata Management Act audits.{' '}
          <Link href="/admin/accounting/gl" className="underline font-medium">
            Open general ledger & bank reconciliation
          </Link>
        </p>
      </header>

      <Card className="!p-4 border-[rgb(var(--sr-coral))]/20 bg-[rgb(var(--sr-bg))]/40">
        <p className="text-sm">
          <span className="font-semibold">Malaysian JMB compliance:</span> Maintenance and sinking
          fund cash must not be commingled. Deposits (renovation, access card, etc.) sit in a
          separate deposits-held account. Export the fund summary PDF and audit trail CSV for AGM
          presentations and Commissioner of Buildings (COB) record-keeping.
        </p>
      </Card>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-from" className="text-xs">
              Report from
            </Label>
            <Input
              id="report-from"
              type="date"
              className="h-8 text-xs"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-to" className="text-xs">
              To
            </Label>
            <Input
              id="report-to"
              type="date"
              className="h-8 text-xs"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!condoId || exportingFundPdf}
            onClick={() => exportFundSummaryPdf()}
          >
            {exportingFundPdf ? 'Exporting…' : 'Fund summary PDF'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!condoId || exportingAudit}
            onClick={() => exportAuditTrailCsv()}
          >
            {exportingAudit ? 'Exporting…' : 'Audit trail CSV'}
          </Button>
        </div>
      </section>

      <Card>
        <h3 className="font-semibold text-sm mb-1">Financial statements</h3>
        <p className="text-xs sr-muted mb-4">
          AGM-ready profit &amp; loss and balance sheet derived from the ledger. Maintenance fund
          and sinking fund are reported separately for Malaysian JMB audits.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="statement-fund" className="text-xs">
                P&amp;L fund (optional)
              </Label>
              <select
                id="statement-fund"
                className="h-8 rounded-md border border-[rgb(var(--sr-border))] bg-transparent px-2 text-xs"
                value={statementFund}
                onChange={(e) => setStatementFund(e.target.value)}
              >
                <option value="">All funds</option>
                <option value="MAINTENANCE">Maintenance fund</option>
                <option value="SINKING_FUND">Sinking fund</option>
                <option value="GENERAL">General fund</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!condoId || exportingPlPdf}
                onClick={() => exportProfitLossPdf()}
              >
                {exportingPlPdf ? 'Exporting…' : 'P&L PDF'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!condoId || exportingPlCsv}
                onClick={() => exportProfitLossCsv()}
              >
                {exportingPlCsv ? 'Exporting…' : 'P&L CSV'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[rgb(var(--sr-border))]/50">
            <div className="flex flex-col gap-1">
              <Label htmlFor="balance-sheet-as-of" className="text-xs">
                Balance sheet as at
              </Label>
              <Input
                id="balance-sheet-as-of"
                type="date"
                className="h-8 text-xs"
                value={balanceSheetAsOf}
                onChange={(e) => setBalanceSheetAsOf(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!condoId || exportingBsPdf}
                onClick={() => exportBalanceSheetPdf()}
              >
                {exportingBsPdf ? 'Exporting…' : 'Balance sheet PDF'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!condoId || exportingBsCsv}
                onClick={() => exportBalanceSheetCsv()}
              >
                {exportingBsCsv ? 'Exporting…' : 'Balance sheet CSV'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {funds.isLoading || fundSummary.isLoading
          ? ['a', 'b', 'c', 'd'].map((k) => <Skeleton key={k} className="h-28" />)
          : (fundSummary.data?.funds ?? funds.data ?? []).map((f) => {
              const current =
                'closingBalance' in f ? f.closingBalance : (f as { balance: number }).balance;
              const priorRow = priorSummary.data?.funds.find((p) => p.fund === f.fund);
              const delta =
                priorRow != null
                  ? Math.round((current - priorRow.closingBalance) * 100) / 100
                  : null;
              return (
                <Card key={f.fund}>
                  <div className="text-xs uppercase sr-muted font-semibold">
                    {FUND_LABELS[f.fund]}
                  </div>
                  <div className="text-2xl font-bold mt-1">{formatMoney(current)}</div>
                  {delta != null ? (
                    <div className="text-xs sr-muted mt-1">
                      {delta >= 0 ? '+' : ''}
                      {formatMoney(delta)} vs prior period
                    </div>
                  ) : null}
                </Card>
              );
            })}
      </section>

      <Card>
        <h3 className="font-semibold text-sm mb-3">Charges vs collections by fund</h3>
        {incomeExpense.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs sr-muted border-b border-[rgb(var(--sr-border))]/70">
                  <th className="pb-2 pr-3 font-medium">Fund</th>
                  <th className="pb-2 pr-3 font-medium text-right">Charges issued</th>
                  <th className="pb-2 font-medium text-right">Collections</th>
                </tr>
              </thead>
              <tbody>
                {(incomeExpense.data?.byFund ?? []).map((row) => (
                  <tr
                    key={row.fund}
                    className="border-b border-[rgb(var(--sr-border))]/40 last:border-0"
                  >
                    <td className="py-2 pr-3">{FUND_LABELS[row.fund]}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatMoney(row.charges)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(row.collections)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(incomeExpense.data?.byCategory.length ?? 0) > 0 ? (
          <div className="mt-4 pt-4 border-t border-[rgb(var(--sr-border))]/50">
            <h4 className="text-xs uppercase sr-muted font-semibold mb-2">By fee line</h4>
            <div className="flex flex-col gap-1 text-sm">
              {incomeExpense.data?.byCategory.slice(0, 8).map((row) => (
                <div key={`${row.fund}-${row.code}`} className="flex justify-between gap-3">
                  <span className="sr-muted truncate">
                    {row.description}
                    <span className="ml-1">({FUND_LABELS[row.fund]})</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {row.charges > 0 ? formatMoney(row.charges) : formatMoney(row.collections)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sm">Collections</h3>
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
            <h3 className="font-semibold text-sm">Collections aging (unpaid invoices)</h3>
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

      {condoId ? <AccountingHeavyPanels condoId={condoId} /> : null}
    </div>
  );
}
