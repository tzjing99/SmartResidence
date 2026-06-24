'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCondoDefects, useMyCondos, useTransitionDefect } from '@smartresidence/api-client';
import {
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUS_LABELS,
  type DefectSeverity,
  type DefectStatus,
  KANBAN_COLUMNS,
  nextDefectStatuses,
} from '@smartresidence/shared-types';
import { Badge, Card, Select, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'];
const SEVERITY_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All severities' },
  ...(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as DefectSeverity[]).map((s) => ({
    value: s,
    label: DEFECT_SEVERITY_LABELS[s],
  })),
];

export default function DefectKanbanPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const defects = useCondoDefects(api, condo?.id ?? null);
  const transition = useTransitionDefect(api);

  const [severity, setSeverity] = React.useState('ALL');
  const [category, setCategory] = React.useState('ALL');
  const [exporting, setExporting] = React.useState(false);

  const items = (defects.data?.items as any[]) ?? [];
  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>(items.map((d) => d.category));
    return [
      { value: 'ALL', label: 'All categories' },
      ...[...set].sort().map((c) => ({ value: c, label: c })),
    ];
  }, [items]);

  async function move(id: string, status: DefectStatus) {
    try {
      await transition.mutateAsync({ id, status });
      toast.success(`Moved to ${DEFECT_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function exportPdf() {
    if (!condo) return;
    setExporting(true);
    try {
      const blob = await api.exportCondoDefectsPdf(condo.id, {
        severity: severity === 'ALL' ? undefined : severity,
        category: category === 'ALL' ? undefined : category,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defects-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (defects.isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-96" />
        ))}
      </div>
    );
  }

  const filtered = items.filter(
    (d) =>
      (severity === 'ALL' || d.severity === severity) &&
      (category === 'ALL' || d.category === category),
  );
  const grouped: Record<string, any[]> = {};
  for (const col of KANBAN_COLUMNS) grouped[col.status] = [];
  for (const d of filtered) {
    const k = d.status === 'ACK' || d.status === 'REOPENED' ? 'NEW' : d.status;
    (grouped[k] ?? grouped.NEW)?.push(d);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Defect board</h1>
          <p className="sr-muted">
            First come, first served — oldest tickets first. Open one to assign, update status, and
            reply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={severity}
            onValueChange={setSeverity}
            options={SEVERITY_FILTER_OPTIONS}
            aria-label="Filter by severity"
            className="w-40"
          />
          <Select
            value={category}
            onValueChange={setCategory}
            options={categoryOptions}
            aria-label="Filter by category"
            className="w-44"
          />
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting || !condo}
            className="inline-flex items-center justify-center gap-2 h-11 rounded-xl px-4 text-sm font-medium bg-[rgb(var(--sr-coral))] text-[rgb(var(--sr-coral-fg))] hover:brightness-105 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </header>
      <div className="grid grid-cols-5 gap-4 min-w-0">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge tone="neutral">{grouped[col.status]?.length ?? 0}</Badge>
            </div>
            <div className="flex flex-col gap-2 min-h-[100px]">
              {(grouped[col.status] ?? []).map((d: any) => (
                <Card key={d.id} className="p-4">
                  <Link href={`/admin/defects/${d.id}`} className="block">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-sm leading-tight hover:text-[rgb(var(--sr-coral))]">
                        {d.title}
                      </div>
                      <Badge
                        tone={
                          d.severity === 'URGENT'
                            ? 'danger'
                            : d.severity === 'HIGH'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {d.severity.toLowerCase()}
                      </Badge>
                    </div>
                    <div className="text-xs sr-muted mb-3">
                      {d.unit?.identifier ?? '—'} · {d.category}
                      {d.assignedTo?.name ? ` · ${d.assignedTo.name}` : ''}
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {nextDefectStatuses(d.status as DefectStatus).map((next) => (
                      <button
                        key={next}
                        type="button"
                        onClick={() => move(d.id, next)}
                        className="text-xs px-2 py-1 rounded-lg bg-[rgb(var(--sr-bg))] hover:bg-[rgb(var(--sr-border))]/60"
                      >
                        → {DEFECT_STATUS_LABELS[next]}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
