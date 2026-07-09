'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCreateVisitorBlacklist,
  useDeleteVisitorBlacklist,
  useMyCondos,
  useUpdateVisitorBlacklist,
  useVisitorBlacklist,
} from '@smartresidence/api-client';
import type { VisitorBlacklist } from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function VisitorBlacklistPanel() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useVisitorBlacklist(api, condo?.id ?? null);
  const create = useCreateVisitorBlacklist(api);
  const update = useUpdateVisitorBlacklist(api);
  const remove = useDeleteVisitorBlacklist(api);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!condo?.id || !reason.trim()) {
      toast.error(t('visitors.blacklist.reasonRequiredToast'));
      return;
    }
    setBusy(true);
    try {
      await create.mutateAsync({
        condoId: condo.id,
        data: {
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          reason: reason.trim(),
        },
      });
      setName('');
      setPhone('');
      setVehiclePlate('');
      setIdNumber('');
      setReason('');
      toast.success(t('visitors.blacklist.addedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(entry: VisitorBlacklist) {
    if (!condo?.id) return;
    try {
      await update.mutateAsync({
        id: entry.id,
        condoId: condo.id,
        data: { active: !entry.active },
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onRemove(entry: VisitorBlacklist) {
    if (!condo?.id) return;
    if (!window.confirm('Remove this person from the block list?')) return;
    try {
      await remove.mutateAsync({ id: entry.id, condoId: condo.id });
      toast.success(t('visitors.blacklist.removedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const items = (list.data?.items ?? []) as Array<
    VisitorBlacklist & { createdBy?: { name: string } }
  >;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Ban className="size-5 text-coral-500 mt-0.5" />
        <div>
          <h3 className="font-semibold text-lg">Blocked visitors</h3>
          <p className="text-sm sr-muted mt-1">
            Block someone by name, phone, car plate, or ID number. Guards are alerted at walk-in and
            check-in when there is a match.
          </p>
        </div>
      </div>

      <form
        onSubmit={onAdd}
        className="grid gap-3 sm:grid-cols-2 border-t border-[rgb(var(--sr-border))] pt-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bl-name">Name</Label>
          <Input
            id="bl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ahmad bin Hassan"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bl-phone">Phone</Label>
          <Input
            id="bl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bl-plate">Vehicle plate</Label>
          <Input
            id="bl-plate"
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value)}
            placeholder="ABC1234"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bl-id">ID number</Label>
          <Input
            id="bl-id"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="bl-reason">Reason</Label>
          <Input
            id="bl-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Why is this person blocked?"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || !condo}>
            <Plus className="size-4" />
            Add entry
          </Button>
        </div>
      </form>

      {list.isLoading ? (
        <p className="text-sm sr-muted">Loading blacklist…</p>
      ) : items.length === 0 ? (
        <p className="text-sm sr-muted">No blacklist entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--sr-border))] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {[entry.name, entry.phone, entry.vehiclePlate, entry.idNumber]
                    .filter(Boolean)
                    .join(' · ') || 'Unnamed entry'}
                </p>
                <p className="text-xs sr-muted mt-0.5">{entry.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={entry.active ? 'danger' : 'neutral'}>
                  {entry.active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleActive(entry)}
                >
                  {entry.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(entry)}
                  aria-label="Remove"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
