'use client';

import {
  ALL,
  BulkActionBar,
  DefectDetailPanel,
  DefectTriageSummary,
  DefectTriageTable,
  DefectTriageToolbar,
  KEEP,
  UNASSIGNED,
  type StaffOption,
  type TriageItem,
  applyTriageFilters,
  canMarkFixed,
  defaultTriageFilters,
  fifoSort,
} from '@/components/defect-triage';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useBulkUpdateReportItems, useDefectReport, useSlaSettings } from '@smartresidence/api-client';
import {
  type DefectStatus,
  defectReference,
  formatUnitLabel,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

export default function ReportTriagePage() {
  const params = useParams<{ id: string }>();
  const report = useDefectReport(api, params.id);
  const detail = report.data;
  const sla = useSlaSettings(api, detail?.condoId ?? null);
  const bulk = useBulkUpdateReportItems(api);

  const [filters, setFilters] = React.useState(defaultTriageFilters);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = React.useState(KEEP);
  const [bulkAssignee, setBulkAssignee] = React.useState(KEEP);
  const [exporting, setExporting] = React.useState(false);

  const staffOptions: StaffOption[] = ((sla.data?.managementStaff ?? []) as Array<{
    id: string;
    name: string;
    email: string | null;
  }>).map((s) => ({ value: s.id, label: s.name || s.email || s.id }));

  const unitLabel = detail?.unit
    ? formatUnitLabel({ id: detail.unit.id, identifier: detail.unit.identifier, block: detail.unit.block })
    : 'Unassigned unit';

  const unitMeta = detail?.unit
    ? [
        detail.unit.block ? `Block ${detail.unit.block.name}` : null,
        detail.unit.floor != null ? `Floor ${detail.unit.floor}` : null,
        `Unit ${detail.unit.identifier}`,
      ].filter(Boolean).join(' · ')
    : null;

  const triageItems = React.useMemo<TriageItem[]>(() => {
    const unit = detail?.unit
      ? formatUnitLabel({ id: detail.unit.id, identifier: detail.unit.identifier, block: detail.unit.block })
      : 'Unassigned unit';
    return (detail?.items ?? [])
      .map((item) => ({
        id: item.id,
        title: item.title,
        reference: defectReference(item.id),
        description: item.description,
        status: item.status,
        severity: item.severity,
        createdAt: item.createdAt,
        category: item.category,
        room: item.spaceLabel,
        element: item.elementName,
        issue: item.issueName,
        unitLabel: unit,
        blockName: detail?.unit?.block?.name ?? null,
        floor: null,
        raisedByName: detail?.raisedBy?.name ?? null,
        assigneeId: item.assignedTo?.id ?? null,
        assigneeName: item.assignedTo?.name ?? null,
        attachmentIds: item.attachments.map((a) => a.id),
        href: `/admin/defects/${item.id}`,
      }))
      .sort(fifoSort);
  }, [detail]);

  const filtered = React.useMemo(
    () => applyTriageFilters(triageItems, filters),
    [triageItems, filters],
  );
  const active = filtered.find((i) => i.id === activeId) ?? filtered[0] ?? null;

  React.useEffect(() => {
    if (activeId && !filtered.some((i) => i.id === activeId)) {
      setActiveId(filtered[0]?.id ?? null);
    }
  }, [activeId, filtered]);

  async function applyToIds(
    defectIds: string[],
    body: { status?: DefectStatus; assignedToUserId?: string | null },
    success?: string,
  ) {
    if (defectIds.length === 0) return;
    try {
      const res = await bulk.mutateAsync({ id: params.id, data: { defectIds, ...body } });
      toast.success(success ?? `Updated ${res.updated} defect(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function applyBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const body: { status?: DefectStatus; assignedToUserId?: string | null } = {};
    if (bulkStatus !== KEEP) body.status = bulkStatus as DefectStatus;
    if (bulkAssignee !== KEEP) {
      body.assignedToUserId = bulkAssignee === UNASSIGNED ? null : bulkAssignee;
    }
    if (body.status === undefined && body.assignedToUserId === undefined) {
      toast.error('Choose a status and/or assignee');
      return;
    }
    await applyToIds(ids, body);
    setSelected(new Set());
    setBulkStatus(KEEP);
    setBulkAssignee(KEEP);
  }

  const fixableCount = triageItems.filter((i) => canMarkFixed(i.status)).length;

  async function markAllFixed() {
    const ids = triageItems.filter((i) => canMarkFixed(i.status)).map((i) => i.id);
    if (ids.length === 0) return;
    await applyToIds(
      ids,
      { status: 'RESOLVED' },
      `${ids.length} defect(s) marked fixed — resident will be notified to sign off`,
    );
  }

  async function markFixed(id: string) {
    const item = triageItems.find((i) => i.id === id);
    if (!item || !canMarkFixed(item.status)) return;
    await applyToIds([id], { status: 'RESOLVED' }, 'Marked fixed — waiting for resident sign-off');
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
    await applyToIds(ids, { status: 'RESOLVED' }, `${ids.length} defect(s) marked fixed`);
    setSelected(new Set());
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await api.exportDefectReportPdf(params.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defect-package-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (report.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/defects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
        >
          <ArrowLeft className="size-4" /> Defect packages
        </Link>
        <p className="sr-muted">This defect package could not be found.</p>
      </div>
    );
  }

  const resolved = detail.statusCounts.RESOLVED ?? 0;
  const closed = detail.statusCounts.CLOSED ?? 0;
  const done = resolved + closed;
  const pct = detail.itemCount > 0 ? Math.round((done / detail.itemCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/defects"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
      >
        <ArrowLeft className="size-4" /> Defect packages
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">Unit package</Badge>
              <span className="text-xs sr-muted">{defectReference(detail.id)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{unitLabel}</h1>
            {unitMeta ? (
              <p className="mt-0.5 text-xs font-medium text-[rgb(var(--sr-coral))]">{unitMeta}</p>
            ) : null}
            <p className="mt-1 text-sm sr-muted">
              {detail.itemCount} defect(s) · submitted by {detail.raisedBy?.name ?? 'resident'} ·{' '}
              {new Date(detail.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllFixed}
              disabled={fixableCount === 0 || bulk.isPending}
              className="inline-flex items-center gap-2 h-11 rounded-xl px-4 text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <CheckCircle2 className="size-4" />
              Mark all active as fixed
            </button>
            <Button onClick={exportPdf} disabled={exporting}>
              <FileText className="size-4" />
              {exporting ? 'Preparing PDF…' : 'Export contractor PDF'}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-2 max-w-md flex-1 overflow-hidden rounded-full bg-[rgb(var(--sr-border))]">
            <div className="h-full bg-[rgb(var(--sr-coral))]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm sr-muted">
            {done}/{detail.itemCount} fixed or signed off ({pct}%)
          </span>
          {resolved > 0 ? (
            <Badge tone="success">{resolved} waiting resident sign-off</Badge>
          ) : null}
        </div>
      </Card>

      <DefectTriageSummary items={triageItems} />
      <DefectTriageToolbar
        filters={filters}
        onFiltersChange={setFilters}
        items={triageItems}
        staffOptions={staffOptions}
      />
      <BulkActionBar
        selectedCount={selected.size}
        staffOptions={staffOptions}
        status={bulkStatus}
        assignee={bulkAssignee}
        busy={bulk.isPending}
        onStatusChange={setBulkStatus}
        onAssigneeChange={setBulkAssignee}
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
          busy={bulk.isPending}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          onSelect={(item) => setActiveId(item.id)}
          onAssign={(id, userId) => applyToIds([id], { assignedToUserId: userId })}
          onStatus={(id, status) => applyToIds([id], { status })}
          onMarkFixed={markFixed}
          empty="No defects match this package view. Clear filters to return to the FIFO list."
        />
        <DefectDetailPanel item={active} onMarkFixed={markFixed} />
      </div>
    </div>
  );
}

