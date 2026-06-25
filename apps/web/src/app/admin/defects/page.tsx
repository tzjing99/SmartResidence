'use client';

import {
  ALL,
  BulkActionBar,
  CondoDefectHeatmap,
  DefectDetailPanel,
  DefectTriageSummary,
  DefectTriageTable,
  DefectTriageToolbar,
  KEEP,
  type StaffOption,
  type TriageItem,
  applyTriageFilters,
  canMarkFixed,
  defaultTriageFilters,
  fifoSort,
} from '@/components/defect-triage';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCondoDefects,
  useDefectReports,
  useMyCondos,
  useSlaSettings,
  useTransitionDefect,
} from '@smartresidence/api-client';
import {
  DEFECT_STATUS_LABELS,
  type DefectReportSummary,
  type DefectStatus,
  defectReference,
  formatUnitLabel,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton, cn } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'];

type Tab = 'board' | 'reports';

export default function DefectsAdminPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [tab, setTab] = React.useState<Tab>('board');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Defect Command Centre</h1>
        </div>
        <div className="inline-flex w-fit rounded-xl border border-[rgb(var(--sr-border))] p-1 bg-[rgb(var(--sr-card))]">
          {(
            [
              { id: 'board', label: 'FIFO board' },
              { id: 'reports', label: 'Unit packages' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 h-9 rounded-lg text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-[rgb(var(--sr-coral))] text-[rgb(var(--sr-coral-fg))]'
                  : 'sr-muted hover:text-[rgb(var(--sr-fg))]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'board' ? (
        <DefectBoard condoId={condo?.id ?? null} />
      ) : (
        <InspectionsList condoId={condo?.id ?? null} />
      )}
    </div>
  );
}

function DefectBoard({ condoId }: { condoId: string | null }) {
  const defects = useCondoDefects(api, condoId);
  const reports = useDefectReports(api, condoId);
  const sla = useSlaSettings(api, condoId);
  const transition = useTransitionDefect(api);
  const [filters, setFilters] = React.useState(defaultTriageFilters);
  const [heatmapBlock, setHeatmapBlock] = React.useState(ALL);
  const [heatmapFloor, setHeatmapFloor] = React.useState(ALL);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = React.useState(KEEP);
  const [exporting, setExporting] = React.useState(false);

  const items = (defects.data?.items as any[]) ?? [];
  const packageItems = reports.data ?? [];
  const triageItems = React.useMemo<TriageItem[]>(() => {
    const standalone = items
      .filter((d) => !d.reportId)
      .map((d) => ({
        id: d.id,
        title: d.title,
        reference: defectReference(d.id),
        description: d.description,
        status: d.status,
        severity: d.severity,
        createdAt: d.createdAt,
        category: d.category,
        room: d.spaceLabel ?? d.location,
        element: d.element?.name ?? null,
        issue: d.issue?.name ?? null,
        unitLabel: d.unit
          ? `${d.unit.block?.name ? `${d.unit.block.name} ` : ''}${d.unit.identifier}`
          : null,
        blockName: d.unit?.block?.name ?? null,
        floor: d.unit?.floor ?? null,
        raisedByName: d.raisedBy?.name ?? null,
        assigneeId: d.assignedTo?.id ?? d.assignedToUserId ?? null,
        assigneeName: d.assignedTo?.name ?? null,
        attachmentIds: (d.attachments ?? []).map((a: { id: string }) => a.id),
        href: `/admin/defects/${d.id}`,
        canMarkFixed: true,
      }));

    const packages = packageItems.map((r) => {
      const status = reportBoardStatus(r);
      const unitLabel = r.unit
        ? formatUnitLabel({ id: r.unit.id, identifier: r.unit.identifier, block: r.unit.block })
        : 'Unassigned unit';
      return {
        id: r.id,
        title: `${unitLabel} defect package`,
        reference: defectReference(r.id),
        description: `${r.itemCount} child defect(s) submitted under this package. Open the package to triage rooms, contractor fixing, and resident sign-off.`,
        status,
        severity: status === 'REOPENED' ? 'HIGH' : 'MEDIUM',
        createdAt: r.createdAt,
        category: 'Unit package',
        room: 'Multiple rooms',
        unitLabel,
        blockName: r.unit?.block?.name ?? null,
        floor: r.unit?.floor ?? null,
        raisedByName: r.raisedBy?.name ?? null,
        assigneeId: null,
        assigneeName: null,
        attachmentIds: [],
        href: `/admin/defects/reports/${r.id}`,
        itemCount: r.itemCount,
        canMarkFixed: false,
      } satisfies TriageItem;
    });

    return [...packages, ...standalone].sort(fifoSort);
  }, [items, packageItems]);
  const filtered = React.useMemo(
    () => applyTriageFilters(triageItems, filters),
    [triageItems, filters],
  );
  const active = filtered.find((i) => i.id === activeId) ?? filtered[0] ?? null;
  const staffOptions: StaffOption[] = (
    (sla.data?.managementStaff ?? []) as Array<{
      id: string;
      name: string;
      email: string | null;
    }>
  ).map((s) => ({ value: s.id, label: s.name || s.email || s.id }));

  React.useEffect(() => {
    if (activeId && !filtered.some((i) => i.id === activeId)) {
      setActiveId(filtered[0]?.id ?? null);
    }
  }, [activeId, filtered]);

  async function move(id: string, status: DefectStatus) {
    try {
      await transition.mutateAsync({ id, status });
      toast.success(
        status === 'RESOLVED'
          ? 'Marked fixed — waiting for resident sign-off'
          : `Moved to ${DEFECT_STATUS_LABELS[status]}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function applyBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (bulkStatus === KEEP) {
      toast.error('Choose a status');
      return;
    }
    for (const id of ids) {
      await move(id, bulkStatus as DefectStatus);
    }
    setSelected(new Set());
    setBulkStatus(KEEP);
  }

  async function markFixed(id: string) {
    const item = triageItems.find((i) => i.id === id);
    if (!item || !canMarkFixed(item.status)) return;
    await move(id, 'RESOLVED');
  }

  async function markSelectedFixed() {
    const ids = [...selected].filter((id) => {
      const item = triageItems.find((i) => i.id === id);
      return item && canMarkFixed(item.status);
    });
    if (ids.length === 0) {
      toast.error('Selected defects cannot be marked fixed yet');
      return;
    }
    for (const id of ids) await markFixed(id);
    setSelected(new Set());
  }

  async function exportPdf() {
    if (!condoId) return;
    setExporting(true);
    try {
      const blob = await api.exportCondoDefectsPdf(condoId, {
        status: filters.status === ALL ? undefined : filters.status,
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

  if (defects.isLoading || reports.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DefectTriageSummary items={triageItems} />
      <CondoDefectHeatmap
        items={triageItems}
        selectedBlock={heatmapBlock}
        selectedFloor={heatmapFloor}
        onSelectBlock={(block) => {
          setHeatmapBlock(block);
          setHeatmapFloor(ALL);
        }}
        onSelectFloor={setHeatmapFloor}
      />
      <DefectTriageToolbar
        filters={filters}
        onFiltersChange={setFilters}
        items={triageItems}
        staffOptions={staffOptions}
        extraActions={
          <Button type="button" onClick={exportPdf} disabled={exporting || !condoId}>
            {exporting ? 'Exporting…' : 'Export contractor PDF'}
          </Button>
        }
      />
      <BulkActionBar
        selectedCount={selected.size}
        status={bulkStatus}
        busy={transition.isPending}
        onStatusChange={setBulkStatus}
        onApply={applyBulk}
        onMarkFixed={markSelectedFixed}
        onClear={() => setSelected(new Set())}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DefectTriageTable
          items={filtered}
          selected={selected}
          activeId={active?.id}
          staffOptions={staffOptions}
          busy={transition.isPending}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          onSelect={(item) => setActiveId(item.id)}
          onStatus={move}
          onMarkFixed={markFixed}
          empty="No defects match this view. Clear filters to see the FIFO queue again."
        />
        <DefectDetailPanel item={active} onMarkFixed={markFixed} />
      </div>
    </div>
  );
}

function reportBoardStatus(report: DefectReportSummary): DefectStatus {
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

function reportProgress(report: DefectReportSummary): { done: number; total: number } {
  const total = report.itemCount;
  const done = (report.statusCounts.RESOLVED ?? 0) + (report.statusCounts.CLOSED ?? 0);
  return { done, total };
}

function InspectionsList({ condoId }: { condoId: string | null }) {
  const reports = useDefectReports(api, condoId);

  if (reports.isLoading) {
    return <Skeleton className="h-64" />;
  }
  if ((reports.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="No unit defect packages yet"
        description="When a resident submits multiple defects, the unit package appears here for contractor handoff and resident sign-off."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reports.data?.map((r) => {
        const { done, total } = reportProgress(r);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const unitLabel = r.unit
          ? formatUnitLabel({ id: r.unit.id, identifier: r.unit.identifier, block: r.unit.block })
          : 'Unassigned unit';
        return (
          <Link key={r.id} href={`/admin/defects/reports/${r.id}`}>
            <Card className="p-4 hover:border-[rgb(var(--sr-coral))]/50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {unitLabel} <span className="text-xs sr-muted">· {defectReference(r.id)}</span>
                  </div>
                  <div className="text-xs sr-muted mt-0.5">
                    {r.title} · {r.itemCount} defect(s) · by {r.raisedBy?.name ?? 'resident'} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32">
                    <div className="h-2 rounded-full bg-[rgb(var(--sr-border))] overflow-hidden">
                      <div
                        className="h-full bg-[rgb(var(--sr-coral))]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] sr-muted mt-1 text-right">
                      {done}/{total} fixed/sign-off
                    </div>
                  </div>
                  <Badge tone={pct === 100 ? 'success' : 'neutral'}>{pct}%</Badge>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
