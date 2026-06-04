'use client';

import { Badge, Card, Skeleton } from '@smartresidence/ui-web';
import { KANBAN_COLUMNS, type DefectStatus } from '@smartresidence/shared-types';
import {
  useCondoDefects,
  useMyCondos,
  useTransitionDefect,
} from '@smartresidence/api-client';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function DefectKanbanPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const defects = useCondoDefects(api, condo?.id ?? null);
  const transition = useTransitionDefect(api);

  if (defects.isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    );
  }

  const items = (defects.data?.items as any[]) ?? [];
  const grouped: Record<string, any[]> = {};
  for (const col of KANBAN_COLUMNS) grouped[col.status] = [];
  for (const d of items) {
    const k = d.status === 'ACK' || d.status === 'REOPENED' ? 'NEW' : d.status;
    (grouped[k] ?? grouped.NEW).push(d);
  }

  async function move(id: string, status: DefectStatus) {
    try {
      await transition.mutateAsync({ id, status });
      toast.success(`Moved to ${status.toLowerCase()}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Defect board</h1>
        <p className="sr-muted">Drag-equivalent transitions via the buttons below.</p>
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
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-sm leading-tight">{d.title}</div>
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
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {nextStatuses(col.status).map((next) => (
                      <button
                        key={next}
                        onClick={() => move(d.id, next)}
                        className="text-xs px-2 py-1 rounded-lg bg-[rgb(var(--sr-bg))] hover:bg-[rgb(var(--sr-border))]/60"
                      >
                        → {next.toLowerCase()}
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

function nextStatuses(s: DefectStatus): DefectStatus[] {
  switch (s) {
    case 'NEW':
      return ['ASSIGNED', 'IN_PROGRESS'];
    case 'ASSIGNED':
      return ['IN_PROGRESS', 'RESOLVED'];
    case 'IN_PROGRESS':
      return ['RESOLVED', 'CLOSED'];
    case 'RESOLVED':
      return ['CLOSED', 'REOPENED' as DefectStatus];
    case 'CLOSED':
      return ['REOPENED' as DefectStatus];
    default:
      return [];
  }
}
