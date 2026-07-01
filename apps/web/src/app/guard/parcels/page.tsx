'use client';

import { type UnitSearchItem, UnitSearchPicker } from '@/components/unit-search-picker';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCollectParcel,
  useCondoParcels,
  useCreateParcel,
  useMyCondos,
} from '@smartresidence/api-client';
import type { Parcel, ParcelStatus } from '@smartresidence/shared-types';
import { PARCEL_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Loader2, Package, Plus } from 'lucide-react';
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

export default function GuardParcelsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const parcels = useCondoParcels(api, condo?.id ?? null, { pendingOnly: true });
  const createParcel = useCreateParcel(api);
  const collectParcel = useCollectParcel(api);

  const [showForm, setShowForm] = React.useState(false);
  const [unit, setUnit] = React.useState<UnitSearchItem | null>(null);
  const [recipientName, setRecipientName] = React.useState('');
  const [carrier, setCarrier] = React.useState('');
  const [trackingRef, setTrackingRef] = React.useState('');
  const [notes, setNotes] = React.useState('');

  async function submit() {
    if (!condo?.id || !unit?.id || !recipientName.trim()) {
      toast.error('Unit and recipient name are required');
      return;
    }
    try {
      await createParcel.mutateAsync({
        condoId: condo.id,
        unitId: unit.id,
        recipientName: recipientName.trim(),
        carrier: carrier.trim() || undefined,
        trackingRef: trackingRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Parcel logged — resident notified');
      setShowForm(false);
      setUnit(null);
      setRecipientName('');
      setCarrier('');
      setTrackingRef('');
      setNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log parcel');
    }
  }

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-coral-500" />
            Parcels
          </h1>
          <p className="sr-muted text-sm mt-1">
            Log incoming deliveries and track lobby collection.
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          Log parcel
        </Button>
      </div>

      {showForm ? (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">New parcel</h2>
          <div className="space-y-2">
            <Label>Unit</Label>
            <UnitSearchPicker value={unit} onChange={setUnit} condoId={condo?.id} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient name</Label>
            <Input
              id="recipient"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Name on label"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Pos Laju, J&T…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking ref</Label>
              <Input
                id="tracking"
                value={trackingRef}
                onChange={(e) => setTrackingRef(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Size, shelf location…"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void submit()} disabled={createParcel.isPending}>
              {createParcel.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save & notify resident
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {parcels.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (parcels.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No pending parcels"
          description="When a courier drops off a package, log it here so the resident is notified."
        />
      ) : (
        <div className="space-y-3">
          {parcels.data?.items.map((p) => (
            <Card key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.recipientName}</div>
                <div className="text-sm sr-muted">
                  {unitLabel(p)}
                  {p.carrier ? ` · ${p.carrier}` : ''}
                  {p.trackingRef ? ` · ${p.trackingRef}` : ''}
                </div>
                <div className="text-xs sr-muted mt-1">Received {fmtDateTime(p.receivedAt)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={STATUS_TONE[p.status]}>{PARCEL_STATUS_LABELS[p.status]}</Badge>
                <Button type="button" size="sm" onClick={() => void markCollected(p.id)}>
                  Collected
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
