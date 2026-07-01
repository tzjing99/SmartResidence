'use client';

import { AdminFilterBar, AdminFilterPill, AdminPageHeader } from '@/components/admin-ui';
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
    <div className="flex flex-col gap-6 max-w-4xl">
      <AdminPageHeader
        eyebrow="Operations"
        icon={Package}
        title="Parcel log"
        description="Lobby deliveries logged by guards — track collection status and follow up on overdue items."
      />

      <AdminFilterBar>
        {(
          [
            { key: 'pending' as const, label: 'Awaiting collection' },
            { key: 'overdue' as const, label: 'Overdue' },
            { key: 'all' as const, label: 'All parcels' },
          ] as const
        ).map((f) => (
          <AdminFilterPill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </AdminFilterPill>
        ))}
      </AdminFilterBar>

      {parcels.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (parcels.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Package className="size-8" />}
          title="No parcels yet"
          description="When a delivery arrives, guards can log it here. Parcels awaiting collection will show in this list."
        />
      ) : (
        <div className="space-y-3">
          {parcels.data?.items.map((p) => (
            <Card key={p.id} className="!p-4 flex flex-wrap items-center justify-between gap-3">
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
                  <Button size="sm" variant="secondary" onClick={() => markCollected(p.id)}>
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
