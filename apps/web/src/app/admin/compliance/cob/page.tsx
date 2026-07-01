'use client';

import { AdminComplianceNote, AdminExportToolbar, AdminPageHeader } from '@/components/admin-ui';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCobTemplates, useMyCondos } from '@smartresidence/api-client';
import { Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Download, Landmark, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

function monthStartIso(d = new Date()) {
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

export default function AdminCobCompliancePage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const [reportFrom, setReportFrom] = React.useState(monthStartIso);
  const [reportTo, setReportTo] = React.useState(todayIso);
  const cob = useCobTemplates(api, condoId, { from: reportFrom, to: reportTo });
  const [downloading, setDownloading] = React.useState<string | null>(null);

  async function downloadTemplate(slug: string, label: string) {
    if (!condoId) return;
    setDownloading(slug);
    try {
      const blob = await api.downloadCobTemplatePdf(condoId, slug, {
        from: reportFrom,
        to: reportTo,
      });
      await downloadBlob(blob, `cob-${slug}-${reportTo}.pdf`);
      toast.success(`${label} downloaded`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  const prefill = cob.data?.prefill;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <AdminPageHeader
        eyebrow="Compliance"
        title="COB forms"
        description="Pre-filled PDF templates for Commissioner of Buildings record-keeping. Download, review, and complete any remaining fields before filing."
      />

      <AdminComplianceNote
        title="Not legal advice"
        summary="Templates are pre-filled from your building data — verify before filing."
      >
        {cob.data?.disclaimer ??
          'These forms are generated from your building records. Always verify figures and consult your management company or legal advisor before submitting to the COB office.'}
      </AdminComplianceNote>

      <AdminExportToolbar>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cob-from" className="text-xs">
            Reporting from
          </Label>
          <Input
            id="cob-from"
            type="date"
            className="h-9"
            value={reportFrom}
            onChange={(e) => setReportFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cob-to" className="text-xs">
            To (as at)
          </Label>
          <Input
            id="cob-to"
            type="date"
            className="h-9"
            value={reportTo}
            onChange={(e) => setReportTo(e.target.value)}
          />
        </div>
      </AdminExportToolbar>

      {cob.isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cob.data?.templates.map((t) => (
            <Card key={t.kind} className="p-5 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">{t.label}</h2>
                <p className="text-sm sr-muted mt-1">{t.description}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-auto w-fit"
                disabled={!condoId || downloading === t.slug}
                onClick={() => downloadTemplate(t.slug, t.label)}
              >
                {downloading === t.slug ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Download className="size-4 mr-2" />
                )}
                Download PDF
              </Button>
            </Card>
          ))}
        </div>
      )}

      {prefill ? (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Landmark className="size-4" />
            Pre-fill snapshot
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="sr-muted">Organization</dt>
              <dd className="font-medium">{prefill.organizationName}</dd>
            </div>
            <div>
              <dt className="sr-muted">Registration no.</dt>
              <dd>{prefill.registrationNo ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="sr-muted">Address</dt>
              <dd>{prefill.address}</dd>
            </div>
            <div>
              <dt className="sr-muted">Blocks / units</dt>
              <dd>
                {prefill.blockCount} blocks · {prefill.unitCount} units
              </dd>
            </div>
            <div>
              <dt className="sr-muted">Data as at</dt>
              <dd>{prefill.asAtDate}</dd>
            </div>
          </dl>

          {prefill.fundBalances.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Fund balances</h3>
              <ul className="text-sm space-y-1">
                {prefill.fundBalances.map((f) => (
                  <li key={f.fund} className="flex justify-between gap-4 max-w-md">
                    <span className="sr-muted">{f.label}</span>
                    <span className="font-medium tabular-nums">{f.balance}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {prefill.managementCommittee.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Management committee</h3>
              <ul className="text-sm space-y-1">
                {prefill.managementCommittee.map((m) => (
                  <li key={`${m.name}-${m.role}`}>
                    {m.name} — {m.role}
                    {m.email ? ` (${m.email})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 pt-4 border-t border-[rgb(var(--sr-border))]">
            <h3 className="text-sm font-medium mb-2">Data sources</h3>
            <ul className="text-xs sr-muted space-y-1">
              {prefill.dataSources.map((s) => (
                <li key={s.field}>
                  <span className="font-medium text-[rgb(var(--sr-fg))]">{s.field}:</span>{' '}
                  {s.source}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      <p className="text-sm sr-muted">
        See also{' '}
        <Link href="/admin/accounting" className="text-coral-600 hover:underline">
          Accounting exports
        </Link>{' '}
        and the{' '}
        <a
          href="https://github.com/smartresidence/smartresidence/blob/main/docs/compliance/malaysia-strata-act.md"
          className="text-coral-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Malaysian strata compliance guide
        </a>
        .
      </p>
    </div>
  );
}
