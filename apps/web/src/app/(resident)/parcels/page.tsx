'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useCollectParcel, useMyUnits, useUnitParcels } from '@smartresidence/api-client';
import type { ParcelStatus } from '@smartresidence/shared-types';
import { PARCEL_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Package } from 'lucide-react';

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

export default function ResidentParcelsPage() {
  useRoleGuard('resident');
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const parcels = useUnitParcels(api, unit?.id ?? null, { pendingOnly: true });
  const collectParcel = useCollectParcel(api);

  async function confirmCollect(id: string) {
    if (!window.confirm('Confirm you have collected this parcel from the lobby?')) return;
    try {
      await collectParcel.mutateAsync({ id });
      toast.success('Thanks — parcel marked as collected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update parcel');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title flex items-center gap-2">
          <Package className="size-6 text-coral-500" aria-hidden />
          Parcels
        </h2>
        <p className="sr-muted mt-1">
          Packages waiting at the lobby for your unit. Tap collected when you pick them up.
        </p>
      </header>

      {parcels.isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (parcels.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No parcels waiting"
          description="When security logs a delivery for your unit, it will appear here."
          action={
            <p className="text-xs sr-muted max-w-sm text-center">
              You&apos;ll get a notification when something arrives — no need to check constantly.
            </p>
          }
        />
      ) : (
        <div className="space-y-3">
          {parcels.data?.items.map((p) => (
            <Card key={p.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.recipientName}</div>
                  <div className="text-sm sr-muted">
                    {p.carrier ?? 'Delivery'}
                    {p.trackingRef ? ` · ${p.trackingRef}` : ''}
                  </div>
                  <div className="text-xs sr-muted mt-1">Received {fmtDateTime(p.receivedAt)}</div>
                </div>
                <Badge tone={STATUS_TONE[p.status]}>{PARCEL_STATUS_LABELS[p.status]}</Badge>
              </div>
              {p.notes ? <p className="text-sm sr-muted">{p.notes}</p> : null}
              <Button
                type="button"
                onClick={() => void confirmCollect(p.id)}
                disabled={collectParcel.isPending}
              >
                I collected this
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
