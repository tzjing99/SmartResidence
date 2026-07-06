'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { useMyUnits, useUnitDefectReports, useUnitDefects } from '@smartresidence/api-client';
import { defectReference } from '@smartresidence/shared-types';
import type { DefectReportSummary, DefectStatus } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Plus } from 'lucide-react';
import Link from 'next/link';

const SKELETON_KEYS = ['s1', 's2', 's3'];

export default function DefectsPage() {
  const t = useT();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const defects = useUnitDefects(api, unit?.id ?? null);
  const reports = useUnitDefectReports(api, unit?.id ?? null);
  const rows = [
    ...(reports.data ?? []).map((r) => ({ kind: 'package' as const, data: r })),
    ...((defects.data?.items as any[]) ?? []).map((d) => ({ kind: 'defect' as const, data: d })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="sr-section-title">{t('defects.title')}</h2>
          <p className="sr-muted">{t('defects.subtitle')}</p>
        </div>
        <Link href="/defects/new">
          <Button>
            <Plus className="size-4" />
            {t('defects.newDefect')}
          </Button>
        </Link>
      </header>

      {defects.isLoading || reports.isLoading ? (
        <div className="flex flex-col gap-3">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-24" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('defects.emptyTitle')}
          description={t('defects.emptyDesc')}
          action={
            <Link href="/defects/new">
              <Button>{t('defects.submitDefect')}</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.data.id}`}>
              {row.kind === 'package' ? (
                <PackageCard report={row.data} t={t} />
              ) : (
                <Link href={`/defects/${row.data.id}`} className="block">
                  <Card className="transition-colors hover:border-[rgb(var(--sr-coral)/0.4)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{row.data.title}</div>
                        <div className="text-xs sr-muted mt-0.5">
                          {row.data.category} · raised{' '}
                          {new Date(row.data.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge status={row.data.status} t={t} />
                      </div>
                    </div>
                  </Card>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PackageCard({
  report,
  t,
}: {
  report: DefectReportSummary;
  t: ReturnType<typeof useT>;
}) {
  const status = reportStatus(report);
  const done = (report.statusCounts.RESOLVED ?? 0) + (report.statusCounts.CLOSED ?? 0);
  const pct = report.itemCount ? Math.round((done / report.itemCount) * 100) : 0;
  return (
    <Link href={`/defects/package/${report.id}`} className="block">
      <Card className="transition-colors hover:border-[rgb(var(--sr-coral)/0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{t('defects.defectReport')}</div>
            <div className="text-sm font-mono text-[rgb(var(--sr-coral))]">
              {defectReference(report.id)}
            </div>
            <div className="text-xs sr-muted mt-0.5">
              {t('defects.itemCount', {
                count: report.itemCount,
                date: new Date(report.createdAt).toLocaleDateString(),
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 max-w-xs rounded-full bg-[rgb(var(--sr-border))] overflow-hidden">
                <div className="h-full bg-[rgb(var(--sr-coral))]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs sr-muted whitespace-nowrap">
                {t('defects.fixedProgress', { done, total: report.itemCount })}
              </span>
            </div>
          </div>
          <StatusBadge status={status} t={t} />
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ status, t }: { status: DefectStatus; t: ReturnType<typeof useT> }) {
  return (
    <Badge tone={status === 'CLOSED' || status === 'RESOLVED' ? 'success' : 'primary'}>
      {status === 'RESOLVED' ? t('defects.waitingSignOff') : status.toLowerCase().replace('_', ' ')}
    </Badge>
  );
}

function reportStatus(report: DefectReportSummary): DefectStatus {
  const counts = report.statusCounts;
  const total = report.itemCount;
  const closed = counts.CLOSED ?? 0;
  const resolved = counts.RESOLVED ?? 0;
  if ((counts.REOPENED ?? 0) > 0) return 'REOPENED';
  if (closed >= total && total > 0) return 'CLOSED';
  if (resolved + closed >= total && total > 0) return 'RESOLVED';
  if ((counts.IN_PROGRESS ?? 0) > 0) return 'IN_PROGRESS';
  if ((counts.ASSIGNED ?? 0) > 0) return 'ASSIGNED';
  if ((counts.ACK ?? 0) > 0) return 'ACK';
  return 'NEW';
}
