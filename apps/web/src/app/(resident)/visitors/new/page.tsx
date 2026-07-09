'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
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
import { Button, Input, Label, NativeSelect, Select, cn } from '@smartresidence/ui-web';
import { Car, Footprints, Info, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

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

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[rgb(var(--sr-border))]/80 bg-white p-4 shadow-sm dark:bg-[rgb(var(--sr-card))]',
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? <p className="text-xs sr-muted mt-0.5">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function NewVisitorPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const platePhotoInputId = useId();
  const overnightCheckboxId = useId();
  const platePhotoRef = useRef<HTMLInputElement>(null);
  const units = useMyUnits(api);
  const condos = useMyCondos(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const condoId = (condos.data?.[0] as { id: string } | undefined)?.id ?? null;
  const create = useCreateVisitor(api);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [platePhotoName, setPlatePhotoName] = useState<string | null>(null);
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
  const purpose = useWatch({ control: form.control, name: 'purpose' });

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
    if (entryMode === 'WALK_IN' && overnight) {
      form.setValue('overnight', false);
    }
  }, [entryMode, overnight, form]);

  useEffect(() => {
    if (unit?.id) form.setValue('unitId', unit.id);
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const phoneCountryCode = searchParams.get('phoneCountryCode');
    const vehiclePlate = searchParams.get('vehiclePlate');
    const entry = searchParams.get('entryMode');
    const purpose = searchParams.get('purpose');
    const expectedAtRaw = searchParams.get('expectedAt');
    if (name) form.setValue('name', name);
    if (phone) form.setValue('phone', phone);
    if (phoneCountryCode) form.setValue('phoneCountryCode', phoneCountryCode);
    if (vehiclePlate) form.setValue('vehiclePlate', vehiclePlate);
    if (entry === 'WALK_IN' || entry === 'DRIVE_IN') form.setValue('entryMode', entry);
    if (purpose) form.setValue('purpose', purpose as CreateVisitorInput['purpose']);
    if (expectedAtRaw) {
      const parsed = new Date(expectedAtRaw);
      if (!Number.isNaN(parsed.getTime())) form.setValue('expectedAt', parsed);
    }
  }, [unit?.id, searchParams, form]);

  const slotsBlocked = Boolean(overnight && preview.data?.slotsFull);
  const showUrgentReason = Boolean(overnight && preview.data?.isUrgent);

  const datetimeValue = useMemo(() => {
    if (!(expectedAt instanceof Date) || Number.isNaN(expectedAt.getTime())) return '';
    return toDatetimeLocalValue(expectedAt);
  }, [expectedAt]);

  async function onPlatePhotoChange(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    setPlatePhotoName(file.name);
    try {
      const key = await uploadPlatePhoto(file);
      setPlatePhotoKey(key);
      toast.success(t('visitors.new.plateUploadedToast'));
    } catch (err) {
      toast.error((err as Error).message);
      setPlatePhotoKey(null);
      setPlatePhotoName(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSubmit(values: CreateVisitorInput) {
    if (!unit) return;
    if (slotsBlocked) {
      toast.error(t('visitors.new.noSlotsToast'));
      return;
    }
    const payload: CreateVisitorInput = {
      ...values,
      unitId: unit.id,
      entryMode: values.overnight ? 'DRIVE_IN' : values.entryMode,
      vehiclePlatePhotoUrl: values.overnight ? (platePhotoKey ?? undefined) : undefined,
    };
    if (values.overnight && !platePhotoKey) {
      toast.error(t('visitors.new.platePhotoRequiredToast'));
      return;
    }
    try {
      const created = await create.mutateAsync(payload);
      if (created.status === 'PENDING_MANAGEMENT_APPROVAL') {
        toast.success(t('visitors.new.pendingApprovalToast'));
      } else {
        toast.success(t('visitors.new.passCreatedToast'));
      }
      router.push(`/visitors/${created.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-xl -mx-4 rounded-2xl bg-stone-50 px-4 py-6 sm:mx-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
      <h2 className="sr-section-title mb-1">{t('visitors.new.title')}</h2>
      <p className="sr-muted mb-6">{t('visitors.new.subtitle')}</p>
      <form className="flex flex-col gap-4 overflow-visible" onSubmit={form.handleSubmit(onSubmit)}>
        <FormSection title={t('visitors.new.entryMode')}>
          <fieldset
            aria-label={t('visitors.new.entryMode')}
            className="grid grid-cols-2 gap-3 border-0 p-0 m-0 min-w-0"
          >
            {(
              [
                { id: 'DRIVE_IN' as const, label: t('visitors.new.driveIn'), icon: Car },
                { id: 'WALK_IN' as const, label: t('visitors.new.walkIn'), icon: Footprints },
              ] as const
            ).map((mode) => {
              const active = entryMode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => form.setValue('entryMode', mode.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition-colors',
                    active
                      ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral)/0.08)] text-[rgb(var(--sr-coral))] shadow-sm'
                      : 'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] text-[rgb(var(--sr-fg))] hover:border-stone-300 hover:bg-stone-50/80 dark:hover:bg-stone-900/30',
                  )}
                >
                  <Icon
                    className={cn('size-6', active ? 'text-[rgb(var(--sr-coral))]' : 'sr-muted')}
                  />
                  {mode.label}
                </button>
              );
            })}
          </fieldset>
        </FormSection>

        <FormSection
          title={t('visitors.new.guestDetails')}
          description={t('visitors.new.guestDetailsDesc')}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Visitor name</Label>
            <Input
              id="name"
              className="bg-white dark:bg-[rgb(var(--sr-card))]"
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phoneCountryCode">Code</Label>
              <NativeSelect id="phoneCountryCode" {...form.register('phoneCountryCode')}>
                {PHONE_COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                className="bg-white dark:bg-[rgb(var(--sr-card))]"
                required
                {...form.register('phone')}
              />
              {form.formState.errors.phone ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose">Purpose</Label>
            <Select
              id="purpose"
              aria-label="Visit purpose"
              value={purpose ?? 'VISITOR'}
              onValueChange={(v) => form.setValue('purpose', v as CreateVisitorInput['purpose'])}
              options={VISITOR_PURPOSE_OPTIONS}
            />
          </div>
        </FormSection>

        {entryMode === 'DRIVE_IN' || overnight ? (
          <FormSection title={t('visitors.new.vehicle')}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehiclePlate">Plate number</Label>
              <Input
                id="vehiclePlate"
                className="bg-white dark:bg-[rgb(var(--sr-card))]"
                {...form.register('vehiclePlate')}
              />
              {overnight ? (
                <p className="text-xs sr-muted">
                  Must match the plate in your photo — management may flag mismatches
                </p>
              ) : null}
              {form.formState.errors.vehiclePlate ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {form.formState.errors.vehiclePlate.message}
                </p>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        <FormSection title={t('visitors.new.arrival')}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedAt">Expected arrival</Label>
            <Input
              id="expectedAt"
              className="bg-white dark:bg-[rgb(var(--sr-card))]"
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
        </FormSection>

        {entryMode !== 'WALK_IN' ? (
          <FormSection
            title={t('visitors.new.overnight')}
            description={t('visitors.new.overnightDesc')}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
                overnight
                  ? 'border-[rgb(var(--sr-coral)/0.35)] bg-[rgb(var(--sr-coral)/0.04)]'
                  : 'border-[rgb(var(--sr-border))] bg-stone-50/50 dark:bg-stone-900/20',
              )}
            >
              <Label htmlFor={overnightCheckboxId} className="cursor-pointer flex-1">
                <p className="text-sm font-semibold">Enable overnight</p>
                <p className="text-xs sr-muted">Drive-in only · plate photo required</p>
              </Label>
              <input
                id={overnightCheckboxId}
                type="checkbox"
                className="size-5 accent-[rgb(var(--sr-coral))]"
                checked={Boolean(overnight)}
                onChange={(e) => form.setValue('overnight', e.target.checked)}
              />
            </div>

            {overnight ? (
              <div className="flex flex-col gap-4 rounded-xl border border-[rgb(var(--sr-border))] bg-stone-50/60 p-4 dark:bg-stone-900/25">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={platePhotoInputId}>Plate photo (required)</Label>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-[rgb(var(--sr-border))] bg-white px-2 dark:bg-[rgb(var(--sr-card))]">
                    <input
                      ref={platePhotoRef}
                      id={platePhotoInputId}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={uploadingPhoto}
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        await onPlatePhotoChange(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 shrink-0 rounded-lg"
                      disabled={uploadingPhoto}
                      onClick={() => platePhotoRef.current?.click()}
                    >
                      <Upload className="size-4" />
                      {uploadingPhoto ? 'Uploading…' : 'Choose file'}
                    </Button>
                    {platePhotoName ? (
                      <span className="inline-flex min-w-0 max-w-[55%] items-center truncate rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-[rgb(var(--sr-fg))] dark:bg-stone-800">
                        {platePhotoName}
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm sr-muted">
                        No file chosen
                      </span>
                    )}
                  </div>
                  {platePhotoKey ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Photo ready — verify plate matches
                    </p>
                  ) : null}
                </div>

                {showUrgentReason ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="urgentReason">Why is this urgent? (required)</Label>
                    <Input
                      id="urgentReason"
                      placeholder="e.g. Family emergency travel"
                      {...form.register('urgentReason')}
                    />
                    {form.formState.errors.urgentReason ? (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {form.formState.errors.urgentReason.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {preview.data ? (
                  <div className="relative overflow-hidden rounded-xl border border-sky-200/70 bg-sky-50/60 pl-4 pr-4 py-3 text-sm dark:border-sky-700/40 dark:bg-sky-950/20">
                    <div
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-sky-500"
                      aria-hidden
                    />
                    <div className="flex gap-3">
                      <Info className="size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <div className="flex flex-col gap-2">
                        <p>{preview.data.helperMessage}</p>
                        {preview.data.isHolidayAuto && !preview.data.slotsFull ? (
                          <p className="font-medium">
                            {preview.data.remainingSlots} of {preview.data.maxSlots} overnight slots
                            left tonight
                          </p>
                        ) : null}
                        {preview.data.slotsFull ? (
                          <p className="font-medium text-red-600 dark:text-red-400">
                            No slots — contact management or register urgent and visit the office
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </FormSection>
        ) : null}

        <div className="flex justify-end gap-3 rounded-xl border border-[rgb(var(--sr-border))]/80 bg-white p-4 shadow-sm dark:bg-[rgb(var(--sr-card))]">
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
            loading={form.formState.isSubmitting}
          >
            Create pass
          </Button>
        </div>
      </form>
    </div>
  );
}
