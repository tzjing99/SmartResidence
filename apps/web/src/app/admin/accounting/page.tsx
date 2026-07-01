'use client';

import dynamic from 'next/dynamic';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useArrearsAging,
  useCollectionsSummary,
  useFundBalances,
  useMyCondos,
} from '@smartresidence/api-client';
import {
  ARREARS_BUCKET_LABELS,
  FUND_LABELS,
  formatMoney,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import * as React from 'react';

const AccountingHeavyPanels = dynamic(
  () =>
    import('./accounting-heavy-panels').then((m) => ({ default: m.AccountingHeavyPanels })),
  { loading: () => <Skeleton className="h-96" /> },
);

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

      {condoId ? <AccountingHeavyPanels condoId={condoId} /> : null}
    </div>
  );
}
