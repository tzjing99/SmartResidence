'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { recommendQuickPass } from '@/lib/quick-pass-recommendation';
import { toast } from '@/lib/toast';
import { useCreateDeliveryPass, useMyUnits, useUnitVisitors } from '@smartresidence/api-client';
import type { DeliveryPlatform, Visitor, VisitorPassKind } from '@smartresidence/shared-types';
import {
  DELIVERY_PLATFORM_OPTIONS,
  QUICK_ENTRY_PASS_KIND_OPTIONS,
  defaultExpectedArrival,
  defaultQuickEntryDurationMins,
  deliveryPlatformLabel,
  toDatetimeLocalValue,
} from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { Bike, ChevronDown, ChevronUp, Package, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type QuickPassKind = Exclude<VisitorPassKind, 'STANDARD'>;

export function DeliveryPassQuickForm() {
  const t = useT();
  const router = useRouter();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const unitId = unit?.id;
  const create = useCreateDeliveryPass(api);
  const history = useUnitVisitors(api, unitId ?? null, 'history', { limit: 20 });
  const [open, setOpen] = useState(false);
  const [passKind, setPassKind] = useState<QuickPassKind>('DELIVERY');
  const [platform, setPlatform] = useState<DeliveryPlatform>('GRABFOOD');
  const [name, setName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [expectedAt, setExpectedAt] = useState<Date>(() => defaultExpectedArrival());
  const recommendationApplied = useRef(false);
  const userChangedDefaults = useRef(false);

  const recommendation = useMemo(
    () => recommendQuickPass((history.data?.items ?? []) as Visitor[]),
    [history.data?.items],
  );

  useEffect(() => {
    if (!unitId) return;
    recommendationApplied.current = false;
    userChangedDefaults.current = false;
    setPassKind('DELIVERY');
    setPlatform('GRABFOOD');
  }, [unitId]);

  useEffect(() => {
    if (
      history.isPlaceholderData ||
      !recommendation.personalized ||
      recommendationApplied.current ||
      userChangedDefaults.current
    ) {
      return;
    }
    setPassKind(recommendation.passKind);
    setPlatform(recommendation.platform);
    recommendationApplied.current = true;
  }, [history.isPlaceholderData, recommendation]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit?.id) {
      toast.error(t('visitors.delivery.selectUnitToast'));
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
      toast.success(t('visitors.delivery.readyToast'));
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
              {recommendation.personalized
                ? t('visitors.delivery.headlineSuggested', {
                    platform: deliveryPlatformLabel(recommendation.platform),
                  })
                : t('visitors.delivery.headline')}
              <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Sparkles className="size-3" aria-hidden />
                {t('visitors.delivery.durationBadge', { hours: durationHours })}
              </span>
            </p>
            <p className="text-sm sr-muted mt-0.5">
              {recommendation.personalized
                ? t('visitors.delivery.suggestedFromHistory', {
                    count: recommendation.sampleSize,
                  })
                : t('visitors.delivery.subtitle')}
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
            <Label>{t('visitors.delivery.kindLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_ENTRY_PASS_KIND_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={passKind === opt.value ? 'primary' : 'secondary'}
                  onClick={() => {
                    userChangedDefaults.current = true;
                    setPassKind(opt.value);
                  }}
                >
                  {opt.value === 'E_HAILING' ? (
                    <Bike className="size-4" aria-hidden />
                  ) : (
                    <Package className="size-4" aria-hidden />
                  )}
                  {t(
                    opt.value === 'E_HAILING'
                      ? 'visitors.delivery.kindRide'
                      : 'visitors.delivery.kindFood',
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-platform">{t('visitors.delivery.platformLabel')}</Label>
            <select
              id="delivery-platform"
              className="sr-select"
              value={platform}
              onChange={(e) => {
                userChangedDefaults.current = true;
                setPlatform(e.target.value as DeliveryPlatform);
              }}
            >
              {DELIVERY_PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs sr-muted">{t('visitors.delivery.platformHint')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-name">{t('visitors.delivery.nameLabel')}</Label>
              <Input
                id="delivery-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('visitors.delivery.namePlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-plate">{t('visitors.delivery.plateLabel')}</Label>
              <Input
                id="delivery-plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder={t('visitors.delivery.platePlaceholder')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-expected-at">{t('visitors.delivery.arrivalLabel')}</Label>
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
              {t('visitors.delivery.validityHint', { minutes: durationMins })}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !unit?.id}
              loading={create.isPending}
            >
              {t('visitors.delivery.createPass')}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
