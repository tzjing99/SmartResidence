'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCreateDeliveryPass, useMyUnits } from '@smartresidence/api-client';
import type { DeliveryPlatform, VisitorPassKind } from '@smartresidence/shared-types';
import {
  DELIVERY_PLATFORM_OPTIONS,
  QUICK_ENTRY_PASS_KIND_OPTIONS,
  defaultExpectedArrival,
  defaultQuickEntryDurationMins,
  toDatetimeLocalValue,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Bike, ChevronDown, ChevronUp, Package, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type QuickPassKind = Exclude<VisitorPassKind, 'STANDARD'>;

export function DeliveryPassQuickForm() {
  const router = useRouter();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const create = useCreateDeliveryPass(api);
  const [open, setOpen] = useState(false);
  const [passKind, setPassKind] = useState<QuickPassKind>('DELIVERY');
  const [platform, setPlatform] = useState<DeliveryPlatform>('GRABFOOD');
  const [name, setName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [expectedAt, setExpectedAt] = useState<Date>(() => defaultExpectedArrival());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit?.id) {
      toast.error('Select a unit first');
      return;
    }
    try {
      const created = await create.mutateAsync({
        unitId: unit.id,
        passKind,
        platform,
        name: name.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        expectedAt,
      });
      toast.success('Pass ready — share the gate code with your rider');
      router.push(`/visitors/${created.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const durationMins = defaultQuickEntryDurationMins(passKind);
  const durationHours = Math.round(durationMins / 60);

  return (
    <Card className="border-amber-500/25 bg-amber-500/[0.03]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left touch-manipulation"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Package className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold flex items-center gap-2 flex-wrap">
              Expecting food or a rider?
              <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Sparkles className="size-3" aria-hidden />~{durationHours}h pass
              </span>
            </p>
            <p className="text-sm sr-muted mt-0.5">
              Create a quick gate pass — no need to fill in visitor details.
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="size-5 shrink-0 sr-muted" aria-hidden />
        ) : (
          <ChevronDown className="size-5 shrink-0 sr-muted" aria-hidden />
        )}
      </button>

      {open ? (
        <form
          className="mt-4 flex flex-col gap-4 border-t border-[rgb(var(--sr-border))] pt-4"
          onSubmit={onSubmit}
        >
          <div className="flex flex-col gap-2">
            <Label>What kind of visit?</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_ENTRY_PASS_KIND_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={passKind === opt.value ? 'primary' : 'secondary'}
                  onClick={() => setPassKind(opt.value)}
                >
                  {opt.value === 'E_HAILING' ? (
                    <Bike className="size-4" aria-hidden />
                  ) : (
                    <Package className="size-4" aria-hidden />
                  )}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-platform">App or service</Label>
            <select
              id="delivery-platform"
              className="sr-select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as DeliveryPlatform)}
            >
              {DELIVERY_PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs sr-muted">Helps guards know what to expect at the gate.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-name">Rider name (optional)</Label>
              <Input
                id="delivery-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skip if you don't know yet"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-plate">Car plate (optional)</Label>
              <Input
                id="delivery-plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="Only if driving in"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-expected-at">When are they arriving?</Label>
            <Input
              id="delivery-expected-at"
              type="datetime-local"
              value={toDatetimeLocalValue(expectedAt)}
              onChange={(e) => {
                const v = e.target.value;
                setExpectedAt(v ? new Date(v) : defaultExpectedArrival());
              }}
            />
            <p className="text-xs sr-muted">
              The pass stays valid for about {durationMins} minutes after arrival, with a little
              buffer for delays.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !unit?.id}
              loading={create.isPending}
            >
              Create pass
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
