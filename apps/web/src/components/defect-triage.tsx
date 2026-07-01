'use client';

import { AuthImage } from '@/components/auth-image';
import { DefectStatusBadge } from '@/components/defect-ui';
import {
  DEFECT_STATUS_LABELS,
  type DefectSeverity,
  type DefectStatus,
  defectReference,
  nextDefectStatuses,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Select, cn } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Flame,
  ImageIcon,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

export const ALL = '__all__';
export const KEEP = '__keep__';
export const UNASSIGNED = '__unassigned__';

export interface TriageItem {
  id: string;
  title: string;
  reference?: string;
  description?: string;
  status: DefectStatus;
  severity: DefectSeverity;
  createdAt: string;
  category?: string | null;
  room?: string | null;
  element?: string | null;
  issue?: string | null;
  unitLabel?: string | null;
  blockName?: string | null;
  floor?: number | null;
  raisedByName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  attachmentIds?: string[];
  href?: string;
  itemCount?: number;
  canMarkFixed?: boolean;
}

export interface StaffOption {
  value: string;
  label: string;
}

export type SortOrder = 'fifo' | 'newest' | 'oldest';

export interface TriageFilters {
  q: string;
  status: string;
  assignee: string;
  block: string;
  floor: string;
  sort: SortOrder;
}

/** Statuses that still need management attention (not fully closed). */
const ACTIVE_STATUSES = new Set<DefectStatus>([
  'NEW',
  'ACK',
  'ASSIGNED',
  'IN_PROGRESS',
  'REOPENED',
  'RESOLVED', // fixed but awaiting resident sign-off — still actionable
]);

export function isActiveDefect(status: DefectStatus) {
  return ACTIVE_STATUSES.has(status);
}

export function isUrgentLike(item: TriageItem) {
  return item.status === 'REOPENED';
}

export function canMarkFixed(status: DefectStatus) {
  return nextDefectStatuses(status).includes('RESOLVED');
}

export function fifoSort(a: TriageItem, b: TriageItem) {
  // Strict first-in-first-out: whoever was submitted earliest comes first,
  // comparing real timestamps (not formatted date strings) so the queue reads
  // as a true chronological order across both standalone defects and packages.
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function applyTriageFilters(items: TriageItem[], filters: TriageFilters) {
  const q = filters.q.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const haystack = [
      item.reference,
      item.title,
      item.description,
      item.unitLabel,
      item.blockName,
      item.category,
      item.room,
      item.element,
      item.issue,
      item.assigneeName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (
      (!q || haystack.includes(q)) &&
      (filters.status === ALL || item.status === filters.status) &&
      (filters.assignee === ALL ||
        (filters.assignee === UNASSIGNED
          ? !item.assigneeId
          : item.assigneeId === filters.assignee)) &&
      (filters.block === ALL || (item.blockName ?? 'Unknown') === filters.block) &&
      (filters.floor === ALL || String(item.floor ?? 'Unknown') === filters.floor)
    );
  });
  return sortItems(filtered, filters.sort ?? 'fifo');
}

export function activeFilterCount(filters: TriageFilters): number {
  return [
    filters.q,
    filters.status !== ALL ? filters.status : '',
    filters.assignee !== ALL ? filters.assignee : '',
    filters.block !== ALL ? filters.block : '',
    filters.floor !== ALL ? filters.floor : '',
  ].filter(Boolean).length;
}

export function defaultTriageFilters(): TriageFilters {
  return { q: '', status: ALL, assignee: ALL, block: ALL, floor: ALL, sort: 'fifo' };
}

export function sortItems(items: TriageItem[], sort: SortOrder): TriageItem[] {
  const clone = [...items];
  switch (sort) {
    case 'newest':
      return clone.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case 'oldest':
      return clone.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    default:
      return clone.sort(fifoSort);
  }
}

export function DefectTriageSummary({ items }: { items: TriageItem[] }) {
  const weight = (item: TriageItem) => item.itemCount ?? 1;
  const total = items.reduce((sum, i) => sum + weight(i), 0);
  const active = items
    .filter((i) => isActiveDefect(i.status))
    .reduce((sum, i) => sum + weight(i), 0);
  const unassigned = items
    .filter((i) => isActiveDefect(i.status) && !i.assigneeId)
    .reduce((sum, i) => sum + weight(i), 0);
  const urgent = items
    .filter((i) => isActiveDefect(i.status) && isUrgentLike(i))
    .reduce((sum, i) => sum + weight(i), 0);
  const waitingSignoff = items
    .filter((i) => i.status === 'RESOLVED' || i.status === 'ACK')
    .reduce((sum, i) => sum + weight(i), 0);
  const closed = items.filter((i) => i.status === 'CLOSED').reduce((sum, i) => sum + weight(i), 0);
  const pct = total > 0 ? Math.round((closed / total) * 100) : 0;

  const cards = [
    { label: 'Active', value: active, hint: 'needs action' },
    { label: 'Unassigned', value: unassigned, hint: 'give ownership' },
    { label: 'High attention', value: urgent, hint: 'urgent, high, or reopened' },
    { label: 'Waiting sign-off', value: waitingSignoff, hint: 'fixed, awaiting resident' },
    { label: 'Closed', value: `${pct}%`, hint: `${closed}/${total || 0} signed off` },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="!p-4">
          <div className="text-xs font-medium uppercase tracking-wide sr-muted">{card.label}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{card.value}</div>
          <div className="mt-1 text-xs sr-muted">{card.hint}</div>
        </Card>
      ))}
    </div>
  );
}

interface HeatmapCell {
  blockName: string;
  floor: number;
  active: number;
  total: number;
  urgent: number;
}

/** Five-step intensity scale (GitHub-contributions style) over the coral brand hue. */
const HEAT_ALPHA = [0, 0.16, 0.36, 0.6, 0.92] as const;

function heatLevel(active: number, max: number): number {
  if (active <= 0) return 0;
  const ratio = active / Math.max(1, max);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function CondoDefectHeatmap({
  items,
  selectedBlock,
  selectedFloor,
  onSelectBlock,
  onSelectFloor,
}: {
  items: TriageItem[];
  selectedBlock: string;
  selectedFloor: string;
  onSelectBlock: (block: string) => void;
  onSelectFloor: (floor: string) => void;
}) {
  const cells = React.useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const item of items) {
      if (!item.blockName || item.floor == null) continue;
      const key = `${item.blockName}:${item.floor}`;
      const row = map.get(key) ?? {
        blockName: item.blockName,
        floor: item.floor,
        active: 0,
        total: 0,
        urgent: 0,
      };
      const weight = item.itemCount ?? 1;
      row.total += weight;
      if (isActiveDefect(item.status) || item.status === 'RESOLVED') row.active += weight;
      if (isActiveDefect(item.status) && isUrgentLike(item)) row.urgent += weight;
      map.set(key, row);
    }
    return map;
  }, [items]);

  const blockNames = React.useMemo(
    () => [...new Set([...cells.values()].map((c) => c.blockName))].sort(),
    [cells],
  );
  const floorNumbers = React.useMemo(
    () => [...new Set([...cells.values()].map((c) => c.floor))].sort((a, b) => a - b),
    [cells],
  );

  // Global scale across every visible cell so the intensity ramp is comparable block-to-block.
  const maxActive = React.useMemo(
    () => Math.max(1, ...[...cells.values()].map((c) => c.active)),
    [cells],
  );

  if (blockNames.length === 0 || floorNumbers.length === 0) {
    return (
      <Card className="!p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-[rgb(var(--sr-coral))]" />
          Building pressure map
        </div>
        <p className="mt-1 text-xs sr-muted">
          Floor pressure will appear here once defects are linked to units with floor data.
        </p>
      </Card>
    );
  }

  const getCell = (block: string, floor: number) => cells.get(`${block}:${floor}`);

  // A specific block can be "focused" via the selector; otherwise stats span the whole portfolio.
  const focusBlock =
    selectedBlock !== ALL && blockNames.includes(selectedBlock) ? selectedBlock : null;
  const scopedCells = [...cells.values()].filter((c) => !focusBlock || c.blockName === focusBlock);

  const totalActive = scopedCells.reduce((sum, c) => sum + c.active, 0);
  const totalUrgent = scopedCells.reduce((sum, c) => sum + c.urgent, 0);

  // Busiest floor within scope: aggregate active per floor across the scoped blocks.
  const floorActive = new Map<number, number>();
  for (const c of scopedCells) floorActive.set(c.floor, (floorActive.get(c.floor) ?? 0) + c.active);
  let hotFloor: number | null = null;
  let hotFloorActive = 0;
  for (const [floor, active] of floorActive) {
    if (active > hotFloorActive) {
      hotFloor = floor;
      hotFloorActive = active;
    }
  }

  function cellStyle(level: number): React.CSSProperties | undefined {
    if (level <= 0) return undefined;
    return { backgroundColor: `rgb(var(--sr-coral) / ${HEAT_ALPHA[level]})` };
  }

  return (
    <Card className="!p-4">
      {/* Header — title, inline stats, block focus all on one compact row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-[rgb(var(--sr-coral))]" />
          Building pressure map
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span
            className="flex items-center gap-1"
            title="Active defects (open or waiting sign-off)"
          >
            <Layers className="size-3.5 text-[rgb(var(--sr-coral))]" />
            <span className="font-semibold">{totalActive}</span>
            <span className="sr-muted">active</span>
          </span>
          <span
            className="flex items-center gap-1"
            title="High attention — urgent, high, or reopened"
          >
            <AlertTriangle className="size-3.5 text-red-500" />
            <span className="font-semibold text-red-600 dark:text-red-300">{totalUrgent}</span>
            <span className="sr-muted">urgent</span>
          </span>
          <span
            className="flex items-center gap-1"
            title={
              hotFloor != null
                ? `Busiest floor: L${hotFloor} (${hotFloorActive} active)`
                : 'No active defects'
            }
          >
            <Flame className="size-3.5 text-[rgb(var(--sr-coral))]" />
            <span className="font-semibold">{hotFloor != null ? `L${hotFloor}` : '—'}</span>
            <span className="sr-muted">busiest</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={focusBlock ?? ALL}
            onValueChange={(v) => {
              onSelectBlock(v);
              onSelectFloor(ALL);
            }}
            options={[
              { value: ALL, label: 'All blocks' },
              ...blockNames.map((name) => ({ value: name, label: `Block ${name}` })),
            ]}
            aria-label="Block focus"
            className="w-32"
          />
          {selectedFloor !== ALL ? (
            <Button variant="ghost" size="sm" onClick={() => onSelectFloor(ALL)}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Compact grid — blocks as rows, floors as columns (short, wide strip) */}
      <div className="mt-3 overflow-x-auto">
        <div
          className="grid w-fit gap-1"
          style={{ gridTemplateColumns: `1.5rem repeat(${floorNumbers.length}, 1.5rem)` }}
        >
          {/* Column header: floor numbers */}
          <div aria-hidden />
          {floorNumbers.map((floor) => (
            <div
              key={`head-${floor}`}
              className="text-center text-[9px] font-medium leading-4 tabular-nums sr-muted"
              title={`Floor ${floor}`}
            >
              {floor}
            </div>
          ))}

          {/* Block rows */}
          {blockNames.map((block) => {
            const dimmed = focusBlock != null && focusBlock !== block;
            return (
              <React.Fragment key={`row-${block}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectBlock(focusBlock === block ? ALL : block);
                    onSelectFloor(ALL);
                  }}
                  className={cn(
                    'flex h-6 items-center justify-center rounded text-[10px] font-semibold leading-none transition-colors hover:text-[rgb(var(--sr-coral))]',
                    dimmed && 'opacity-40',
                  )}
                  title={`Block ${block}`}
                >
                  {block}
                </button>
                {floorNumbers.map((floor) => {
                  const cell = getCell(block, floor);
                  const active = cell?.active ?? 0;
                  const urgent = cell?.urgent ?? 0;
                  const level = heatLevel(active, maxActive);
                  const selected = selectedBlock === block && selectedFloor === String(floor);
                  const tip = cell
                    ? `Block ${block} · L${floor} — ${active} active${
                        urgent > 0 ? `, ${urgent} urgent` : ''
                      } (${cell.total} total)`
                    : `Block ${block} · L${floor} — no defects`;
                  return (
                    <button
                      key={`${block}-${floor}`}
                      type="button"
                      onClick={() => {
                        onSelectBlock(block);
                        onSelectFloor(String(floor));
                      }}
                      style={cellStyle(level)}
                      className={cn(
                        'relative size-6 rounded-[3px] border transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--sr-coral))]',
                        level === 0
                          ? 'border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))]'
                          : 'border-transparent',
                        dimmed && 'opacity-40',
                        selected &&
                          'ring-2 ring-[rgb(var(--sr-coral))] ring-offset-1 ring-offset-[rgb(var(--sr-card))]',
                      )}
                      title={tip}
                      aria-label={tip}
                    >
                      {urgent > 0 ? (
                        <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-red-500 ring-1 ring-[rgb(var(--sr-card))]" />
                      ) : null}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Single-line legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sr-muted">
        <span className="flex items-center gap-1">
          <span>Less</span>
          <span className="size-3 rounded-[2px] border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))]" />
          {HEAT_ALPHA.slice(1).map((alpha) => (
            <span
              key={alpha}
              className="size-3 rounded-[2px]"
              style={{ backgroundColor: `rgb(var(--sr-coral) / ${alpha})` }}
            />
          ))}
          <span>More</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="relative inline-flex size-3 items-center justify-center rounded-[2px] border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))]">
            <span className="size-1 rounded-full bg-red-500" />
          </span>
          high attention
        </span>
        <span className="ml-auto hidden sm:block">Overview only — does not filter the queue</span>
      </div>
    </Card>
  );
}

export function DefectTriageToolbar({
  filters,
  onFiltersChange,
  items,
  staffOptions,
  extraActions,
}: {
  filters: TriageFilters;
  onFiltersChange: (filters: TriageFilters) => void;
  items: TriageItem[];
  staffOptions?: StaffOption[];
  extraActions?: React.ReactNode;
}) {
  const update = (patch: Partial<TriageFilters>) => onFiltersChange({ ...filters, ...patch });
  const clearAll = () => onFiltersChange(defaultTriageFilters());
  const activeCount = activeFilterCount(filters);

  const blockOptions = [
    ...new Set(items.map((i) => i.blockName).filter(Boolean) as string[]),
  ].sort();
  const floorOptions = [...new Set(items.map((i) => i.floor).filter((f): f is number => f != null))]
    .sort((a, b) => a - b)
    .map((f) => String(f));

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Row 1 — search + sort + actions */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--sr-border))] px-3 py-2.5">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--sr-muted))]" />
          <input
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search unit, room, issue, assignee…"
            className="h-9 w-full rounded-lg border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/70 pl-9 pr-3 text-sm outline-none focus:border-[rgb(var(--sr-coral))] focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/20"
          />
        </label>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <span className="text-xs sr-muted font-medium hidden sm:block">Sort:</span>
          <Select
            value={filters.sort ?? 'fifo'}
            onValueChange={(v) => update({ sort: v as SortOrder })}
            options={[
              { value: 'fifo', label: 'Oldest first' },
              { value: 'newest', label: 'Newest first' },
              { value: 'severity', label: 'By severity' },
            ]}
            aria-label="Sort order"
            className="w-48"
          />
          {extraActions}
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg px-3 text-xs font-medium border border-[rgb(var(--sr-border))] hover:border-[rgb(var(--sr-coral))]/50 hover:text-[rgb(var(--sr-coral))] transition-colors"
            >
              <X className="size-3.5" />
              Clear ({activeCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* Row 2 — filters */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <SlidersHorizontal className="size-4 shrink-0 sr-muted" />
        <Select
          value={filters.status}
          onValueChange={(v) => update({ status: v })}
          options={[
            { value: ALL, label: 'All statuses' },
            ...(Object.keys(DEFECT_STATUS_LABELS) as DefectStatus[]).map((s) => ({
              value: s,
              label: s === 'RESOLVED' ? 'Waiting sign-off' : DEFECT_STATUS_LABELS[s],
            })),
          ]}
          aria-label="Status"
          className={cn('w-44', filters.status !== ALL && 'border-[rgb(var(--sr-coral))]/60')}
        />
        <Select
          value={filters.assignee}
          onValueChange={(v) => update({ assignee: v })}
          options={[
            { value: ALL, label: 'All assignees' },
            { value: UNASSIGNED, label: 'Unassigned' },
            ...(staffOptions ?? []),
          ]}
          aria-label="Assignee"
          className={cn('w-44', filters.assignee !== ALL && 'border-[rgb(var(--sr-coral))]/60')}
        />
        <Select
          value={filters.block}
          onValueChange={(v) => update({ block: v, floor: ALL })}
          options={[
            { value: ALL, label: 'All blocks' },
            ...blockOptions.map((b) => ({ value: b, label: `Block ${b}` })),
          ]}
          aria-label="Block"
          className={cn('w-36', filters.block !== ALL && 'border-[rgb(var(--sr-coral))]/60')}
        />
        <Select
          value={filters.floor}
          onValueChange={(v) => update({ floor: v })}
          options={[
            { value: ALL, label: 'All floors' },
            ...floorOptions.map((f) => ({ value: f, label: `Floor ${f}` })),
          ]}
          aria-label="Floor"
          className={cn('w-36', filters.floor !== ALL && 'border-[rgb(var(--sr-coral))]/60')}
        />
        {activeCount > 0 && (
          <span className="ml-auto text-xs sr-muted">
            {activeCount} filter{activeCount > 1 ? 's' : ''} active
          </span>
        )}
      </div>
    </Card>
  );
}

export function BulkActionBar({
  selectedCount,
  staffOptions,
  status,
  assignee,
  busy,
  onStatusChange,
  onAssigneeChange,
  onApply,
  onMarkFixed,
  onClear,
}: {
  selectedCount: number;
  staffOptions?: StaffOption[];
  status: string;
  assignee?: string;
  busy?: boolean;
  onStatusChange: (value: string) => void;
  onAssigneeChange?: (value: string) => void;
  onApply: () => void;
  onMarkFixed?: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;
  return (
    <Card className="sticky top-20 z-20 flex flex-wrap items-center gap-3 !py-3 border-[rgb(var(--sr-coral))]/40 shadow-sm">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <Select
        value={status}
        onValueChange={onStatusChange}
        options={[
          { value: KEEP, label: 'Keep status' },
          ...(Object.keys(DEFECT_STATUS_LABELS) as DefectStatus[]).map((s) => ({
            value: s,
            label: s === 'RESOLVED' ? 'Mark fixed / waiting sign-off' : DEFECT_STATUS_LABELS[s],
          })),
        ]}
        aria-label="Bulk status"
        className="w-56"
      />
      {onAssigneeChange ? (
        <Select
          value={assignee ?? KEEP}
          onValueChange={onAssigneeChange}
          options={[
            { value: KEEP, label: 'Keep assignee' },
            { value: UNASSIGNED, label: 'Unassign' },
            ...(staffOptions ?? []),
          ]}
          aria-label="Bulk assignee"
          className="w-44"
        />
      ) : null}
      {onMarkFixed ? (
        <Button variant="soft-success" onClick={onMarkFixed} disabled={busy}>
          <CheckCircle2 className="size-4" /> Mark fixed
        </Button>
      ) : null}
      <Button onClick={onApply} disabled={busy}>
        {busy ? 'Applying…' : 'Apply'}
      </Button>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </Card>
  );
}

export function DefectTriageTable({
  items,
  selected,
  activeId,
  staffOptions,
  busy,
  empty,
  onToggle,
  onSelect,
  onAssign,
  onStatus,
  onMarkFixed,
}: {
  items: TriageItem[];
  selected: Set<string>;
  activeId?: string | null;
  staffOptions?: StaffOption[];
  busy?: boolean;
  empty?: React.ReactNode;
  onToggle?: (id: string) => void;
  onSelect?: (item: TriageItem) => void;
  onAssign?: (id: string, userId: string | null) => void;
  onStatus?: (id: string, status: DefectStatus) => void;
  onMarkFixed?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Card className="!p-6 text-sm sr-muted">
        {empty ?? 'No defects match the current filters.'}
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[rgb(var(--sr-bg))] text-xs uppercase tracking-wide sr-muted">
            <tr>
              <th className="w-8 px-2 py-2.5 text-left"> </th>
              <th className="px-3 py-2.5 text-left">Defect</th>
              <th className="px-3 py-2.5 text-left">Unit / room</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Assignee</th>
              <th className="px-3 py-2.5 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--sr-border))]">
            {items.map((item) => {
              const markFixed = (item.canMarkFixed ?? true) && canMarkFixed(item.status);
              return (
                <tr
                  key={item.id}
                  className={cn(
                    'align-middle hover:bg-[rgb(var(--sr-bg))]/70',
                    activeId === item.id && 'bg-[rgb(var(--message-mgmt-coral-bg))]/70',
                  )}
                >
                  <td className="px-2 py-2.5">
                    {onToggle ? (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => onToggle(item.id)}
                        className="size-4 rounded border-[rgb(var(--sr-border))]"
                        aria-label={`Select ${item.title}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 max-w-[280px]">
                    <button
                      type="button"
                      onClick={() => onSelect?.(item)}
                      className="block w-full text-left"
                    >
                      <span className="font-medium leading-snug hover:text-[rgb(var(--sr-coral))] line-clamp-1">
                        {item.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs sr-muted">
                        <span className="font-mono">
                          {item.reference ?? defectReference(item.id)}
                        </span>
                        <span>·</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.itemCount && item.itemCount > 1 ? (
                          <span className="ml-0.5">{item.itemCount} items</span>
                        ) : null}
                        {item.attachmentIds?.length ? (
                          <span className="inline-flex items-center gap-0.5">
                            <ImageIcon className="size-3" />
                            {item.attachmentIds.length}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <div className="font-medium text-sm leading-snug line-clamp-1">
                      {item.unitLabel ?? '—'}
                    </div>
                    <div className="text-xs sr-muted line-clamp-1">
                      {[item.floor != null ? `L${item.floor}` : null, item.room ?? item.category]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1.5">
                        <DefectStatusBadge status={item.status} />
                      </div>
                      {item.status === 'RESOLVED' ? (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          Awaiting sign-off
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm">
                      {item.assigneeName ?? (
                        <span className="sr-muted italic text-xs">Unassigned</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {markFixed && onMarkFixed ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onMarkFixed(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300 whitespace-nowrap"
                        >
                          <CheckCircle2 className="size-3" /> Mark fixed
                        </button>
                      ) : null}
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-xs sr-muted hover:text-[rgb(var(--sr-coral))] whitespace-nowrap"
                        >
                          Open →
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function DefectDetailPanel({
  item,
  onMarkFixed,
}: {
  item: TriageItem | null;
  onMarkFixed?: (id: string) => void;
}) {
  if (!item) {
    return (
      <Card className="sticky top-24 !p-5">
        <div className="text-sm font-semibold">Focused review</div>
        <p className="mt-2 text-sm sr-muted">
          Select a defect to review resident notes, photos, and next action without leaving the
          queue.
        </p>
      </Card>
    );
  }

  return (
    <Card className="sticky top-24 !p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs sr-muted">{item.reference ?? defectReference(item.id)}</div>
          <h3 className="mt-1 font-semibold leading-snug">{item.title}</h3>
        </div>
        <DefectStatusBadge status={item.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.unitLabel ? <Badge tone="neutral">{item.unitLabel}</Badge> : null}
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        <div>
          <dt className="text-xs font-medium sr-muted">Location</dt>
          <dd>
            {[
              item.blockName ? `Block ${item.blockName}` : null,
              item.floor != null ? `L${item.floor}` : null,
              item.room,
            ]
              .filter(Boolean)
              .join(' · ') || '-'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium sr-muted">Contractor note</dt>
          <dd className="whitespace-pre-wrap leading-relaxed">
            {item.description || 'No note provided.'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium sr-muted">Assignee</dt>
          <dd>{item.assigneeName ?? 'Unassigned'}</dd>
        </div>
      </dl>
      {item.attachmentIds?.length ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium sr-muted">Resident photos</div>
          <div className="grid grid-cols-2 gap-2">
            {item.attachmentIds.slice(0, 4).map((id) => (
              <AuthImage
                key={id}
                attachmentId={id}
                variant="thumb"
                alt=""
                className="aspect-[4/3] rounded-xl"
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {(item.canMarkFixed ?? true) && canMarkFixed(item.status) && onMarkFixed ? (
          <Button variant="soft-success" onClick={() => onMarkFixed(item.id)}>
            <CheckCircle2 className="size-4" /> Mark fixed
          </Button>
        ) : null}
        {item.href ? (
          <Button variant="secondary" asChild>
            <Link href={item.href}>Open full detail</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
