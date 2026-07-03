'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useBankReconciliationWorksheet,
  useBankStatementImports,
  useChartOfAccounts,
  useGlBankAccounts,
  useGlJournalDetail,
  useGlJournals,
  useImportBankStatement,
  useMatchBankLine,
  useMyCondos,
} from '@smartresidence/api-client';
import type { GlAccountNode } from '@smartresidence/shared-types';
import {
  FUND_LABELS,
  GL_ACCOUNT_TYPE_LABELS,
  GL_SOURCE_TYPE_LABELS,
  formatMoney,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label, Skeleton, Textarea } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function CoaTree({ nodes, depth = 0 }: { nodes: GlAccountNode[]; depth?: number }) {
  if (nodes.length === 0) return null;
  return (
    <ul
      className={
        depth === 0
          ? 'flex flex-col gap-1'
          : 'ml-4 mt-1 flex flex-col gap-1 border-l border-[rgb(var(--sr-border))]/40 pl-3'
      }
    >
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs sr-muted w-12">{n.code}</span>
            <span className={n.active ? '' : 'line-through sr-muted'}>{n.name}</span>
            <Badge tone="neutral">{GL_ACCOUNT_TYPE_LABELS[n.type]}</Badge>
            <span className="text-xs sr-muted">{FUND_LABELS[n.fund]}</span>
          </div>
          {n.children.length > 0 ? <CoaTree nodes={n.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

function BankImportForm({ condoId }: { condoId: string }) {
  const bankAccounts = useGlBankAccounts(api, condoId);
  const importMut = useImportBankStatement(api, condoId);
  const [accountId, setAccountId] = React.useState('');
  const [periodStart, setPeriodStart] = React.useState(monthStartIso());
  const [periodEnd, setPeriodEnd] = React.useState(todayIso());
  const [openingBalance, setOpeningBalance] = React.useState('0');
  const [closingBalance, setClosingBalance] = React.useState('0');
  const [csv, setCsv] = React.useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !csv.trim()) {
      toast.error('Pick a bank account and paste CSV data');
      return;
    }
    try {
      const res = await importMut.mutateAsync({
        accountId,
        periodStart,
        periodEnd,
        openingBalance: Number(openingBalance),
        closingBalance: Number(closingBalance),
        csv,
      });
      toast.success(`Imported ${res.id.slice(0, 8)}… — open worksheet to match lines`);
      setCsv('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <p className="text-xs sr-muted">
        Paste CSV with columns: date, description, amount. Malaysian bank exports (Maybank, CIMB,
        etc.) usually work after removing extra header rows.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-acct">Bank GL account</Label>
          <select
            id="bank-acct"
            className="sr-select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Select…</option>
            {(bankAccounts.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-start">Period start</Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-end">Period end</Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="open-bal">Opening balance (MYR)</Label>
          <Input
            id="open-bal"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="close-bal">Closing balance (MYR)</Label>
          <Input
            id="close-bal"
            type="number"
            step="0.01"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bank-csv">Statement CSV</Label>
        <Textarea
          id="bank-csv"
          rows={5}
          placeholder={
            '2026-06-01,FPX COLLECTION UNIT A-12-03,150.00\n2026-06-02,MAINT FEE TRANSFER,-85.00'
          }
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
      </div>
      <Button type="submit" loading={importMut.isPending}>
        Import statement
      </Button>
    </form>
  );
}

function ReconWorksheet({ condoId, importId }: { condoId: string; importId: string }) {
  const ws = useBankReconciliationWorksheet(api, condoId, importId);
  const match = useMatchBankLine(api, condoId, importId);
  const [selectedStmt, setSelectedStmt] = React.useState<string | null>(null);

  async function onMatch(journalLineId: string) {
    if (!selectedStmt) return;
    try {
      await match.mutateAsync({ lineId: selectedStmt, journalLineId });
      toast.success('Line matched');
      setSelectedStmt(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (ws.isLoading) return <Skeleton className="h-64" />;
  if (!ws.data) return <p className="text-sm sr-muted">Worksheet unavailable.</p>;

  const { import: imp, statementLines, glLines, summary } = ws.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs sr-muted">Period</div>
          <div className="font-medium">
            {imp.periodStart} → {imp.periodEnd}
          </div>
        </div>
        <div>
          <div className="text-xs sr-muted">Account</div>
          <div className="font-medium">
            {imp.account.code} {imp.account.name}
          </div>
        </div>
        <div>
          <div className="text-xs sr-muted">Matched</div>
          <div className="font-medium">
            {summary.matchedCount} / {summary.statementLineCount}
          </div>
        </div>
        <div>
          <div className="text-xs sr-muted">Unmatched GL lines</div>
          <div className="font-medium">{summary.unmatchedGlCount}</div>
        </div>
      </div>

      <p className="text-xs sr-muted">
        Pick a bank line, then click Match on a GL line. Matched pairs confirm your books agree with
        the bank statement for COB / auditor review.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">Bank statement</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-[rgb(var(--sr-border))]/50 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[rgb(var(--sr-bg))]">
                <tr className="text-left text-xs sr-muted border-b">
                  <th className="p-2">Date</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {statementLines.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-[rgb(var(--sr-border))]/30 ${
                      selectedStmt === l.id ? 'bg-[rgb(var(--sr-coral))]/10' : ''
                    } ${l.matchedJournalLineId ? 'opacity-60' : ''}`}
                  >
                    <td className="p-2 whitespace-nowrap">{l.date}</td>
                    <td className="p-2">{l.description}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(l.amount)}</td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedStmt(l.id)}
                      >
                        {selectedStmt === l.id ? 'Selected' : 'Pick'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">GL cash entries</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-[rgb(var(--sr-border))]/50 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[rgb(var(--sr-bg))]">
                <tr className="text-left text-xs sr-muted border-b">
                  <th className="p-2">Date</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Dr / Cr</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {glLines.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-[rgb(var(--sr-border))]/30 ${l.matched ? 'opacity-60' : ''}`}
                  >
                    <td className="p-2 whitespace-nowrap">{l.entryDate}</td>
                    <td className="p-2">
                      {l.entryDescription}
                      <span className="block text-xs sr-muted">{FUND_LABELS[l.fund]}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {l.debit > 0 ? formatMoney(l.debit) : formatMoney(-l.credit)}
                    </td>
                    <td className="p-2 text-right">
                      {selectedStmt && !l.matched ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onMatch(l.id)}
                        >
                          Match
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneralLedgerPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const [journalFrom, setJournalFrom] = React.useState(monthStartIso());
  const [journalTo, setJournalTo] = React.useState(todayIso());
  const [selectedJournal, setSelectedJournal] = React.useState<string | null>(null);
  const [selectedImport, setSelectedImport] = React.useState<string | null>(null);

  const coa = useChartOfAccounts(api, condoId);
  const journals = useGlJournals(api, condoId, { from: journalFrom, to: journalTo });
  const journalDetail = useGlJournalDetail(api, condoId, selectedJournal);
  const imports = useBankStatementImports(api, condoId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm sr-muted mb-1">
          <Link href="/admin/accounting" className="hover:underline">
            Accounting
          </Link>
          <span>/</span>
          <span>General ledger</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">General ledger</h1>
        <p className="sr-muted">
          Double-entry books for your JMB — chart of accounts, journal entries mirrored from
          billing, and bank reconciliation worksheets for treasurers and auditors.
        </p>
      </header>

      <Card className="!p-4 border-[rgb(var(--sr-coral))]/20 bg-[rgb(var(--sr-bg))]/40">
        <p className="text-sm">
          <span className="font-semibold">How this ties to billing:</span> When invoices are issued
          or payments collected, SmartResidence writes to the operational ledger (unit balances) and
          automatically posts matching GL journals — debit receivable / credit income on invoice,
          debit bank / credit receivable on payment. Maintenance and sinking fund lines stay
          separated by fund tag on each journal line.
        </p>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-sm mb-3">Chart of accounts</h3>
          {coa.isLoading ? (
            <Skeleton className="h-48" />
          ) : (coa.data?.length ?? 0) === 0 ? (
            <p className="text-sm sr-muted">No accounts yet.</p>
          ) : (
            <CoaTree nodes={coa.data ?? []} />
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <h3 className="font-semibold text-sm flex-1">Journal entries</h3>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={journalFrom}
              onChange={(e) => setJournalFrom(e.target.value)}
            />
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={journalTo}
              onChange={(e) => setJournalTo(e.target.value)}
            />
          </div>
          {journals.isLoading ? (
            <Skeleton className="h-48" />
          ) : (journals.data?.length ?? 0) === 0 ? (
            <p className="text-sm sr-muted">
              No journals in this period. Issue an invoice or record a payment to see auto-posted
              entries.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs sr-muted border-b">
                    <th className="pb-2 pr-2">Date</th>
                    <th className="pb-2 pr-2">Description</th>
                    <th className="pb-2 pr-2">Source</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {(journals.data ?? []).map((j) => (
                    <tr
                      key={j.id}
                      className={`border-b border-[rgb(var(--sr-border))]/30 ${
                        selectedJournal === j.id ? 'bg-[rgb(var(--sr-coral))]/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-2 whitespace-nowrap">{j.entryDate}</td>
                      <td className="py-2 pr-2">{j.description}</td>
                      <td className="py-2 pr-2 text-xs">{GL_SOURCE_TYPE_LABELS[j.sourceType]}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(j.totalDebit)}</td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedJournal(j.id)}
                        >
                          Lines
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedJournal && journalDetail.data ? (
            <div className="mt-4 pt-4 border-t border-[rgb(var(--sr-border))]/50">
              <h4 className="text-xs uppercase sr-muted font-semibold mb-2">Entry lines</h4>
              <div className="flex flex-col gap-1 text-sm">
                {journalDetail.data.lines.map((l) => (
                  <div key={l.id} className="flex justify-between gap-2">
                    <span>
                      <span className="font-mono text-xs sr-muted mr-1">{l.accountCode}</span>
                      {l.accountName}
                      <span className="text-xs sr-muted ml-1">({FUND_LABELS[l.fund]})</span>
                    </span>
                    <span className="tabular-nums shrink-0">
                      {l.debit > 0 ? `Dr ${formatMoney(l.debit)}` : `Cr ${formatMoney(l.credit)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-sm mb-3">Bank reconciliation</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BankImportForm condoId={condoId ?? ''} />
            <div className="mt-4">
              <h4 className="text-xs uppercase sr-muted font-semibold mb-2">Past imports</h4>
              {(imports.data ?? []).length === 0 ? (
                <p className="text-sm sr-muted">No imports yet.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {(imports.data ?? []).map((imp) => (
                    <li key={imp.id}>
                      <button
                        type="button"
                        className={`text-left w-full rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--sr-bg))]/60 ${
                          selectedImport === imp.id ? 'bg-[rgb(var(--sr-coral))]/10' : ''
                        }`}
                        onClick={() => setSelectedImport(imp.id)}
                      >
                        <span className="font-medium">{imp.account.code}</span>
                        <span className="sr-muted ml-1">
                          {imp.periodStart} – {imp.periodEnd}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="lg:col-span-2">
            {selectedImport && condoId ? (
              <ReconWorksheet condoId={condoId} importId={selectedImport} />
            ) : (
              <p className="text-sm sr-muted">
                Import a bank statement CSV or select a past import to open the reconciliation
                worksheet.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
