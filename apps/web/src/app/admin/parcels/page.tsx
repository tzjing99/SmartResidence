'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCollectParcel, useCondoParcels, useMyCondos } from '@smartresidence/api-client';
import type { Parcel, ParcelStatus } from '@smartresidence/shared-types';
import { PARCEL_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Package } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<ParcelStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  RECEIVED: 'neutral',
  NOTIFIED: 'warning',
  COLLECTED: 'success',
  OVERDUE: 'danger',
};

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function unitLabel(p: Parcel) {
  const block = p.unit?.block?.name;
  const id = p.unit?.identifier;
  if (block && id) return `${block} · ${id}`;
  return id ?? '—';
}

export default function AdminParcelsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [filter, setFilter] = React.useState<'pending' | 'all' | 'overdue'>('pending');
  const params =
    filter === 'pending'
      ? { pendingOnly: true }
      : filter === 'overdue'
        ? { status: 'OVERDUE' }
        : {};
  const parcels = useCondoParcels(api, condo?.id ?? null, params);
  const collectParcel = useCollectParcel(api);

  async function markCollected(id: string) {
    if (!window.confirm('Mark this parcel as collected?')) return;
    try {
      await collectParcel.mutateAsync({ id });
      toast.success('Parcel marked collected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update parcel');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="size-6" />
          Parcel log
        </h1>
        <p className="sr-muted text-sm mt-1">
          Lobby deliveries logged by guards — collection status.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'overdue', 'all'] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? 'primary' : 'secondary'}
            onClick={() => setFilter(f)}
          >
            {f === 'pending' ? 'Awaiting collection' : f === 'overdue' ? 'Overdue' : 'All'}
          </Button>
        ))}
      </div>

      {parcels.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (parcels.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No parcels" description="Nothing in this view yet." />
      ) : (
        <div className="space-y-3">
          {parcels.data?.items.map((p) => (
            <Card key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{p.recipientName}</div>
                <div className="text-sm sr-muted">
                  {unitLabel(p)}
                  {p.carrier ? ` · ${p.carrier}` : ''}
                </div>
                <div className="text-xs sr-muted mt-1">
                  Received {fmtDateTime(p.receivedAt)}
                  {p.collectedAt ? ` · Collected ${fmtDateTime(p.collectedAt)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[p.status]}>{PARCEL_STATUS_LABELS[p.status]}</Badge>
                {p.status !== 'COLLECTED' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void markCollected(p.id)}
                  >
                    Mark collected
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
