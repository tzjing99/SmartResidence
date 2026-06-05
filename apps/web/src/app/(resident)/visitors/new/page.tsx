'use client';

import { api } from '@/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateVisitor,
  useMyCondos,
  useMyUnits,
  useOvernightPreview,
} from '@smartresidence/api-client';
import {
  type CreateVisitorInput,
  CreateVisitorSchema,
  PHONE_COUNTRY_CODES,
  VISITOR_PURPOSE_OPTIONS,
  defaultExpectedArrival,
  toDatetimeLocalValue,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Car, Footprints, Info } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

async function uploadPlatePhoto(file: File): Promise<string> {
  const presign = await api.presignAttachment({
    contentType: file.type || 'image/jpeg',
    fileName: file.name || 'plate.jpg',
  });
  const res = await fetch(presign.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'image/jpeg' },
  });
  if (!res.ok) throw new Error('Failed to upload plate photo');
  return presign.key;
}

export default function NewVisitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const units = useMyUnits(api);
  const condos = useMyCondos(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const condoId = (condos.data?.[0] as { id: string } | undefined)?.id ?? null;
  const create = useCreateVisitor(api);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const form = useForm<CreateVisitorInput>({
    resolver: zodResolver(CreateVisitorSchema),
    defaultValues: {
      unitId: unit?.id ?? '',
      entryMode: 'DRIVE_IN',
      phoneCountryCode: '+60',
      purpose: 'VISITOR',
      overnight: false,
      expectedAt: defaultExpectedArrival(),
    },
  });

  const entryMode = useWatch({ control: form.control, name: 'entryMode' });
  const overnight = useWatch({ control: form.control, name: 'overnight' });
  const expectedAt = useWatch({ control: form.control, name: 'expectedAt' });

  const preview = useOvernightPreview(
    api,
    condoId,
    expectedAt instanceof Date && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
    Boolean(overnight),
  );

  useEffect(() => {
    if (overnight) form.setValue('entryMode', 'DRIVE_IN');
  }, [overnight, form]);

  useEffect(() => {
    if (unit?.id) form.setValue('unitId', unit.id);
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const phoneCountryCode = searchParams.get('phoneCountryCode');
    const vehiclePlate = searchParams.get('vehiclePlate');
    const entry = searchParams.get('entryMode');
    if (name) form.setValue('name', name);
    if (phone) form.setValue('phone', phone);
    if (phoneCountryCode) form.setValue('phoneCountryCode', phoneCountryCode);
    if (vehiclePlate) form.setValue('vehiclePlate', vehiclePlate);
    if (entry === 'WALK_IN' || entry === 'DRIVE_IN') form.setValue('entryMode', entry);
  }, [unit?.id, searchParams, form]);

  const slotsBlocked = Boolean(overnight && preview.data?.slotsFull);
  const showUrgentReason = Boolean(overnight && preview.data?.isUrgent);

  const datetimeValue = useMemo(() => {
    if (!(expectedAt instanceof Date) || Number.isNaN(expectedAt.getTime())) return '';
    return toDatetimeLocalValue(expectedAt);
  }, [expectedAt]);

  async function onSubmit(values: CreateVisitorInput) {
    if (!unit) return;
    if (slotsBlocked) {
      toast.error('No overnight slots left tonight — contact management');
      return;
    }
    const payload: CreateVisitorInput = {
      ...values,
      unitId: unit.id,
      entryMode: values.overnight ? 'DRIVE_IN' : values.entryMode,
      vehiclePlatePhotoUrl: values.overnight ? (platePhotoKey ?? undefined) : undefined,
    };
    if (values.overnight && !platePhotoKey) {
      toast.error('Upload a plate photo that matches the typed plate number');
      return;
    }
    try {
      const created = await create.mutateAsync(payload);
      if (created.status === 'PENDING_MANAGEMENT_APPROVAL') {
        toast.success('Submitted for management approval');
      } else {
        toast.success('Visitor pass created');
      }
      router.push(`/visitors/${created.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="sr-section-title mb-1">Pre-register a visitor</h2>
      <p className="sr-muted mb-6">
        Most guests drive in — set plate, arrival time, and optional overnight stay. Walk-in is
        still available if they arrive on foot.
      </p>
      <Card>
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2">
            <Label>How are they arriving?</Label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: 'DRIVE_IN' as const, label: 'Drive in', icon: Car },
                  { id: 'WALK_IN' as const, label: 'Walk in', icon: Footprints },
                ] as const
              ).map((mode) => {
                const active = entryMode === mode.id;
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => form.setValue('entryMode', mode.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[rgb(var(--sr-primary))] bg-[rgb(var(--sr-primary)/0.08)]'
                        : 'border-[rgb(var(--sr-border))] hover:bg-[rgb(var(--sr-surface-elevated))]'
                    }`}
                  >
                    <Icon className="size-6" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Visitor name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phoneCountryCode">Code</Label>
              <select
                id="phoneCountryCode"
                className="h-10 rounded-lg border border-[rgb(var(--sr-border))] bg-transparent px-2 text-sm"
                {...form.register('phoneCountryCode')}
              >
                {PHONE_COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
          </div>

          {entryMode === 'DRIVE_IN' || overnight ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehiclePlate">Plate number</Label>
              <Input id="vehiclePlate" {...form.register('vehiclePlate')} />
              {overnight ? (
                <p className="text-xs sr-muted">
                  Must match the plate in your photo — management may flag mismatches
                </p>
              ) : null}
              {form.formState.errors.vehiclePlate ? (
                <p className="text-xs text-red-600">{form.formState.errors.vehiclePlate.message}</p>
              ) : null}
            </div>
          ) : null}

          {overnight ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="platePhoto">Plate photo (required)</Label>
              <Input
                id="platePhoto"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploadingPhoto}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingPhoto(true);
                  try {
                    const key = await uploadPlatePhoto(file);
                    setPlatePhotoKey(key);
                    toast.success('Plate photo uploaded');
                  } catch (err) {
                    toast.error((err as Error).message);
                    setPlatePhotoKey(null);
                  } finally {
                    setUploadingPhoto(false);
                  }
                }}
              />
              {platePhotoKey ? (
                <p className="text-xs text-emerald-700">Photo ready — verify plate matches</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedAt">Expected arrival</Label>
            <Input
              id="expectedAt"
              type="datetime-local"
              value={datetimeValue}
              onChange={(e) => {
                const v = e.target.value;
                form.setValue('expectedAt', v ? new Date(v) : defaultExpectedArrival(), {
                  shouldValidate: true,
                });
              }}
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--sr-border))] px-4 py-3">
            <div>
              <p className="text-sm font-medium">Overnight stay</p>
              <p className="text-xs sr-muted">Visitor stays past midnight</p>
            </div>
            <input
              type="checkbox"
              className="size-5 accent-[rgb(var(--sr-primary))]"
              checked={Boolean(overnight)}
              onChange={(e) => form.setValue('overnight', e.target.checked)}
            />
          </label>

          {overnight && preview.data ? (
            <Card className="flex gap-3 border-[rgb(var(--sr-primary)/0.25)] bg-[rgb(var(--sr-primary)/0.05)] p-4">
              <Info className="size-5 shrink-0 text-[rgb(var(--sr-primary))]" />
              <div className="flex flex-col gap-2 text-sm">
                <p>{preview.data.helperMessage}</p>
                {preview.data.isHolidayAuto && !preview.data.slotsFull ? (
                  <p className="font-medium">
                    {preview.data.remainingSlots} of {preview.data.maxSlots} overnight slots left
                    tonight
                  </p>
                ) : null}
                {preview.data.slotsFull ? (
                  <p className="text-red-600 font-medium">
                    No slots — contact management or register urgent and visit the office
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {showUrgentReason ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="urgentReason">Why is this urgent? (required)</Label>
              <Input
                id="urgentReason"
                placeholder="e.g. Family emergency travel"
                {...form.register('urgentReason')}
              />
              {form.formState.errors.urgentReason ? (
                <p className="text-xs text-red-600">{form.formState.errors.urgentReason.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose">Purpose</Label>
            <select
              id="purpose"
              className="h-10 rounded-lg border border-[rgb(var(--sr-border))] bg-transparent px-3 text-sm"
              {...form.register('purpose')}
            >
              {VISITOR_PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || slotsBlocked || uploadingPhoto}
            >
              {form.formState.isSubmitting ? 'Submitting…' : 'Create pass'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
