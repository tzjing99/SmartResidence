'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCreatePatrolCheckpoint,
  useDeletePatrolCheckpoint,
  useMyCondos,
  usePatrolCheckpoints,
  usePatrolScans,
  useRegeneratePatrolCode,
  useUpdatePatrolCheckpoint,
} from '@smartresidence/api-client';
import type {
  CreatePatrolCheckpointInput,
  PatrolCheckpointStatus,
  PatrolScan,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Copy, MapPin, Pencil, Plus, RefreshCw, Route, Trash2 } from 'lucide-react';
import * as React from 'react';

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type FormState = {
  name: string;
  description: string;
  expectedIntervalMinutes: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  expectedIntervalMinutes: '',
  active: true,
};

function checkpointToForm(c: PatrolCheckpointStatus): FormState {
  return {
    name: c.name,
    description: c.description ?? '',
    expectedIntervalMinutes: c.expectedIntervalMinutes ? String(c.expectedIntervalMinutes) : '',
    active: c.active,
  };
}

function CheckpointForm({
  condoId,
  editing,
  onDone,
}: {
  condoId: string;
  editing: PatrolCheckpointStatus | null;
  onDone: () => void;
}) {
  const createCheckpoint = useCreatePatrolCheckpoint(api);
  const updateCheckpoint = useUpdatePatrolCheckpoint(api);
  const [form, setForm] = React.useState<FormState>(
    editing ? checkpointToForm(editing) : emptyForm,
  );
  const pending = createCheckpoint.isPending || updateCheckpoint.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      expectedIntervalMinutes: form.expectedIntervalMinutes
        ? Number(form.expectedIntervalMinutes)
        : undefined,
      active: form.active,
    };
    try {
      if (editing) {
        await updateCheckpoint.mutateAsync({ id: editing.id, data: payload });
        toast.success('Checkpoint updated');
      } else {
        await createCheckpoint.mutateAsync({ condoId, ...payload } as CreatePatrolCheckpointInput);
        toast.success('Checkpoint created');
      }
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="cp-name">Name</Label>
          <Input
            id="cp-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Block A Lobby, Basement 2 Ramp, Rooftop Genset"
            required
            minLength={2}
          />
        </div>
        <div>
          <Label htmlFor="cp-desc">Description (optional)</Label>
          <Input
            id="cp-desc"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Where the QR sticker is placed, what to check…"
          />
        </div>
        <div>
          <Label htmlFor="cp-interval">Expected scan interval (minutes, optional)</Label>
          <Input
            id="cp-interval"
            type="number"
            min={5}
            max={1440}
            value={form.expectedIntervalMinutes}
            onChange={(e) => set('expectedIntervalMinutes', e.target.value)}
            placeholder="e.g. 120 — flag as overdue if not scanned in time"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          Active (guards can scan this checkpoint)
        </label>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {editing ? 'Save changes' : 'Create checkpoint'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CheckpointCard({
  checkpoint,
  onEdit,
}: {
  checkpoint: PatrolCheckpointStatus;
  onEdit: () => void;
}) {
  const regenerate = useRegeneratePatrolCode(api);
  const remove = useDeletePatrolCheckpoint(api);
  const [showCode, setShowCode] = React.useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(checkpoint.code);
      toast.success('Checkpoint code copied to clipboard');
    } catch {
      toast.error('Could not copy — select the code and copy manually');
    }
  };

  const handleRegenerate = async () => {
    if (
      !window.confirm(
        'Rotate this checkpoint QR code? The old printed QR sticker will stop working and must be reprinted.',
      )
    ) {
      return;
    }
    try {
      await regenerate.mutateAsync(checkpoint.id);
      toast.success('QR code rotated — reprint and replace the sticker');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete checkpoint "${checkpoint.name}"?`)) return;
    try {
      await remove.mutateAsync(checkpoint.id);
      toast.success('Checkpoint removed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const lastScan = fmtDateTime(checkpoint.lastScanAt);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="size-4 text-[rgb(var(--sr-coral))] shrink-0" />
            <span className="font-medium">{checkpoint.name}</span>
            {!checkpoint.active ? <Badge tone="neutral">Inactive</Badge> : null}
            {checkpoint.overdue ? <Badge tone="danger">Overdue</Badge> : null}
          </div>
          {checkpoint.description ? (
            <p className="text-sm sr-muted mt-0.5">{checkpoint.description}</p>
          ) : null}
          <p className="text-sm sr-muted mt-1">
            {lastScan
              ? `Last scan ${lastScan}${checkpoint.lastScanGuardName ? ` by ${checkpoint.lastScanGuardName}` : ''}`
              : 'No scans yet'}
            {` · ${checkpoint.scansToday} scan${checkpoint.scansToday === 1 ? '' : 's'} today`}
            {checkpoint.expectedIntervalMinutes
              ? ` · every ${checkpoint.expectedIntervalMinutes} min`
              : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowCode((s) => !s)}>
            {showCode ? 'Hide code' : 'View code'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit checkpoint">
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} aria-label="Delete checkpoint">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {showCode ? (
        <div className="mt-3 rounded-lg border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/70 p-3">
          <Label>QR checkpoint code</Label>
          <p className="text-xs sr-muted mb-2">
            Encode this value in the printed QR sticker guards scan on patrol.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 break-all rounded bg-[rgb(var(--sr-card))] border border-[rgb(var(--sr-border))] px-2 py-1.5 text-sm font-mono">
              {checkpoint.code}
            </code>
            <Button size="sm" variant="secondary" onClick={copyCode}>
              <Copy className="size-4 mr-1.5" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRegenerate}
              loading={regenerate.isPending}
            >
              <RefreshCw className="size-4 mr-1.5" />
              Rotate code
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function PatrolHistory({ condoId }: { condoId: string }) {
  const scans = usePatrolScans(api, condoId, {});
  const items = (scans.data?.items ?? []) as PatrolScan[];

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Patrol history</h2>
        <p className="text-sm sr-muted mt-0.5">Most recent checkpoint scans by guards on duty.</p>
      </div>
      {scans.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : scans.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load patrol history. Please retry.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm sr-muted">No patrol scans recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((scan) => (
            <div
              key={scan.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgb(var(--sr-border))] p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{scan.checkpoint?.name ?? 'Checkpoint'}</span>
                  <Badge tone={scan.source === 'OFFLINE' ? 'warning' : 'success'}>
                    {scan.source === 'OFFLINE' ? 'Offline' : 'Online'}
                  </Badge>
                </div>
                <p className="text-sm sr-muted mt-0.5">
                  {scan.guard?.name ?? 'Guard'} · {fmtDateTime(scan.scannedAt)}
                </p>
                {scan.note ? <p className="text-sm sr-muted mt-1 italic">{scan.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminPatrolPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [includeInactive, setIncludeInactive] = React.useState(true);
  const checkpoints = usePatrolCheckpoints(api, condo?.id ?? null, { includeInactive });
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<PatrolCheckpointStatus | null>(null);

  const items = (checkpoints.data ?? []) as PatrolCheckpointStatus[];

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Route className="size-6 text-[rgb(var(--sr-coral))]" />
            Guard patrol
          </h1>
          <p className="text-sm sr-muted mt-1">
            Manage QR checkpoints for guard tours and review patrol scan history.
          </p>
        </div>
        {!showForm ? (
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-4 mr-1.5" />
            New checkpoint
          </Button>
        ) : null}
      </div>

      {showForm && condo?.id ? (
        <CheckpointForm condoId={condo.id} editing={editing} onDone={closeForm} />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Checkpoints</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
        {checkpoints.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : checkpoints.isError ? (
          <Card className="p-5">
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load checkpoints. Please retry.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => checkpoints.refetch()}
            >
              Retry
            </Button>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title={t("admin.patrol.emptyTitle")}
            description="Add your first patrol checkpoint — e.g. Block A Lobby or Basement 2 Ramp — and print its QR sticker."
          />
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <CheckpointCard
                key={c.id}
                checkpoint={c}
                onEdit={() => {
                  setEditing(c);
                  setShowForm(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {condo?.id ? <PatrolHistory condoId={condo.id} /> : null}
    </div>
  );
}
