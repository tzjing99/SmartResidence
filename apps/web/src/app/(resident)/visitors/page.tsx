'use client';

import { DeliveryPassQuickForm } from '@/components/delivery-pass-quick-form';
import { PillTabs } from '@/components/pill-tabs';
import { RecurringPassesPanel } from '@/components/recurring-passes-panel';
import { ResidentConfirmDialog } from '@/components/resident-confirm-dialog';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { visitorStatusLabelKey, visitorStatusTone } from '@/lib/visitor-status';
import {
  useApproveVisitor,
  useCancelVisitor,
  useCreateFavouriteVisitor,
  useCreateVisitor,
  useDeleteFavouriteVisitor,
  useFavouriteVisitors,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import type { FavouriteVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import {
  canOneClickPreRegFromVisitor,
  canOwnerCancelVisitor,
  defaultExpectedArrival,
  deliveryPlatformLabel,
  favouriteToPreRegParams,
  formatMalaysiaPhoneDisplay,
  isQuickEntryPass,
  passKindLabel,
  toDatetimeLocalValue,
  visitorToCreateInput,
  visitorToPreRegParams,
} from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  CardFooter,
  EmptyState,
  Input,
  Label,
  Skeleton,
} from '@smartresidence/ui-web';
import { Heart, Plus, Star, Trash2, UserPlus, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type VisitorTab = VisitorListView | 'favourites' | 'recurring';

const SKELETON_KEYS = ['s1', 's2', 's3'];

function showInviteAgain(tab: VisitorListView, v: Visitor): boolean {
  return tab === 'history' && (v.status === 'CHECKED_OUT' || v.visitType === 'PRE_REG');
}

export default function VisitorsPage() {
  const t = useT();
  const [tab, setTab] = useState<VisitorTab>('upcoming');
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;

  const liveVisitors = useUnitVisitors(api, unit?.id ?? null, 'live');
  const liveCount = liveVisitors.data?.total ?? 0;

  const TAB_ITEMS: { id: VisitorTab; label: string }[] = useMemo(
    () => [
      { id: 'upcoming', label: t('visitors.tabs.upcoming') },
      {
        id: 'live',
        label:
          liveCount > 0 ? `${t('visitors.tabs.live')} (${liveCount})` : t('visitors.tabs.live'),
      },
      { id: 'history', label: t('visitors.tabs.history') },
      { id: 'recurring', label: 'Recurring' },
      { id: 'favourites', label: t('visitors.tabs.favourites') },
    ],
    [t, liveCount],
  );

  const listView: VisitorListView | undefined =
    tab === 'upcoming' || tab === 'history' || tab === 'live' ? tab : undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null, listView);
  const favourites = useFavouriteVisitors(api, tab === 'favourites' ? (unit?.id ?? null) : null);
  const listLoading = units.isPending || visitors.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="sr-section-title">{t('visitors.title')}</h2>
          <p className="sr-muted">{t('visitors.subtitle')}</p>
        </div>
        <Link href="/visitors/new">
          <Button>
            <Plus className="size-4" />
            {t('visitors.preRegister')}
          </Button>
        </Link>
      </section>

      <PillTabs items={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Visitor views" />

      <DeliveryPassQuickForm />

      {tab === 'favourites' ? (
        <FavouritesPanel
          unitId={unit?.id}
          items={(favourites.data?.items ?? []) as FavouriteVisitor[]}
          isLoading={favourites.isLoading}
        />
      ) : tab === 'recurring' ? (
        <RecurringPassesPanel unitId={unit?.id} />
      ) : (
        <VisitorListPanel
          tab={tab}
          unitId={unit?.id}
          items={(visitors.data?.items ?? []) as Visitor[]}
          isLoading={listLoading}
        />
      )}
    </div>
  );
}

function VisitorListPanel({
  tab,
  unitId,
  items,
  isLoading,
}: {
  tab: VisitorListView;
  unitId?: string;
  items: Visitor[];
  isLoading: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);
  const create = useCreateVisitor(api);
  const cancel = useCancelVisitor(api);
  const [inviteAgainVisitor, setInviteAgainVisitor] = useState<Visitor | null>(null);
  const [inviteExpectedAt, setInviteExpectedAt] = useState<Date>(() => defaultExpectedArrival());
  const [cancelVisitorTarget, setCancelVisitorTarget] = useState<Visitor | null>(null);

  function openInviteAgain(v: Visitor) {
    if (!v.phone?.trim()) {
      toast.error(t('visitors.inviteAgainNeedPhone'));
      const params = new URLSearchParams(visitorToPreRegParams(v));
      router.push(`/visitors/new?${params.toString()}`);
      return;
    }
    if (!canOneClickPreRegFromVisitor(v)) {
      const params = new URLSearchParams(visitorToPreRegParams(v));
      router.push(`/visitors/new?${params.toString()}`);
      return;
    }
    setInviteExpectedAt(defaultExpectedArrival());
    setInviteAgainVisitor(v);
  }

  async function confirmInviteAgain() {
    if (!unitId || !inviteAgainVisitor) return;
    try {
      const created = await create.mutateAsync(
        visitorToCreateInput(inviteAgainVisitor, unitId, inviteExpectedAt),
      );
      setInviteAgainVisitor(null);
      toast.success(t('visitors.inviteAgainSuccess'));
      router.push(`/visitors/${created.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      const params = new URLSearchParams(visitorToPreRegParams(inviteAgainVisitor));
      setInviteAgainVisitor(null);
      router.push(`/visitors/new?${params.toString()}`);
    }
  }

  async function confirmCancelPass() {
    if (!unitId || !cancelVisitorTarget) return;
    try {
      await cancel.mutateAsync({ visitorId: cancelVisitorTarget.id, unitId });
      setCancelVisitorTarget(null);
      toast.success(t('visitors.cancelPassSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function onApprove(id: string) {
    try {
      await approve.mutateAsync(id);
      toast.success(t('visitors.approveSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onReject(id: string) {
    try {
      await reject.mutateAsync({ visitorId: id });
      toast.success(t('visitors.rejectSuccess'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-20" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    const empty =
      tab === 'upcoming'
        ? {
            title: t('visitors.emptyUpcoming'),
            description: t('visitors.emptyUpcomingHint'),
            action: (
              <Link href="/visitors/new">
                <Button>{t('visitors.preRegister')}</Button>
              </Link>
            ),
          }
        : tab === 'live'
          ? {
              title: t('visitors.emptyLive'),
              description: t('visitors.emptyLiveHint'),
            }
          : {
              title: t('visitors.emptyHistory'),
              description: t('visitors.emptyHistoryHint'),
            };
    return (
      <EmptyState
        title={empty.title}
        description={empty.description}
        action={'action' in empty ? empty.action : undefined}
      />
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((v) => (
        <Card key={v.id} className="flex h-full flex-col">
          <div className="flex flex-1 items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2 flex-wrap">
                {v.name}
                {isQuickEntryPass(v) ? (
                  <Badge tone="warning" className="shrink-0">
                    {v.deliveryPlatform
                      ? deliveryPlatformLabel(v.deliveryPlatform)
                      : passKindLabel(v.passKind ?? 'DELIVERY')}
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs sr-muted mt-0.5">
                {v.visitType === 'WALKIN_UNIT'
                  ? `${t('visitors.guard.visitTypeWalkInUnit')} · `
                  : ''}
                {tab === 'live'
                  ? t('visitors.onSiteNow')
                  : tab === 'history' && v.status === 'CHECKED_OUT'
                    ? t('visitors.statusLabel.CHECKED_OUT')
                    : t('visitors.expectedAt', { time: new Date(v.expectedAt).toLocaleString() })}
                {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                {v.purpose ? ` · ${v.purpose}` : ''}
              </div>
              {v.accessCode && tab === 'upcoming' ? (
                <Link href={`/visitors/${v.id}`} className="block mt-2">
                  <span className="font-mono text-lg font-semibold tracking-widest hover:underline">
                    {v.accessCode}
                  </span>
                </Link>
              ) : null}
              {v.status === 'PENDING_OWNER_APPROVAL' ? (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => onApprove(v.id)} disabled={approve.isPending}>
                    {t('visitors.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onReject(v.id)}
                    disabled={reject.isPending}
                  >
                    {t('visitors.reject')}
                  </Button>
                </div>
              ) : v.visitType === 'PRE_REG' && v.status === 'APPROVED' && tab === 'upcoming' ? (
                <Link
                  href={`/visitors/${v.id}`}
                  className="text-sm text-coral-500 hover:underline mt-2 inline-block"
                >
                  {t('visitors.viewPass')} →
                </Link>
              ) : null}
            </div>
            <Badge tone={visitorStatusTone(v.status)}>{t(visitorStatusLabelKey(v.status))}</Badge>
          </div>
          {showInviteAgain(tab, v) || (tab === 'upcoming' && canOwnerCancelVisitor(v)) ? (
            <CardFooter className="mt-auto flex-col sm:flex-row sm:justify-end gap-2 !items-stretch sm:!items-center">
              {tab === 'upcoming' && canOwnerCancelVisitor(v) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCancelVisitorTarget(v)}
                  disabled={cancel.isPending}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="size-4" aria-hidden />
                  {t('visitors.cancelPass')}
                </Button>
              ) : null}
              {showInviteAgain(tab, v) ? (
                <Button
                  size="sm"
                  variant="soft-sky"
                  onClick={() => openInviteAgain(v)}
                  disabled={create.isPending}
                  className="w-full sm:w-auto"
                >
                  <UserPlus className="size-4" aria-hidden />
                  {t('visitors.inviteAgain')}
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      ))}

      <ResidentConfirmDialog
        open={inviteAgainVisitor !== null}
        title={t('visitors.inviteAgainConfirmTitle')}
        description={
          inviteAgainVisitor
            ? `${inviteAgainVisitor.name}${
                formatMalaysiaPhoneDisplay(
                  inviteAgainVisitor.phone,
                  inviteAgainVisitor.phoneCountryCode,
                )
                  ? ` · ${formatMalaysiaPhoneDisplay(inviteAgainVisitor.phone, inviteAgainVisitor.phoneCountryCode)}`
                  : ''
              }`
            : undefined
        }
        confirmLabel={t('visitors.inviteAgainConfirm')}
        cancelLabel={t('actions.cancel')}
        onConfirm={() => void confirmInviteAgain()}
        onCancel={() => setInviteAgainVisitor(null)}
        confirmPending={create.isPending}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-expected-at">{t('visitors.inviteAgainSessionQuestion')}</Label>
          <Input
            id="invite-expected-at"
            type="datetime-local"
            value={toDatetimeLocalValue(inviteExpectedAt)}
            onChange={(e) => {
              const v = e.target.value;
              setInviteExpectedAt(v ? new Date(v) : defaultExpectedArrival());
            }}
          />
          <p className="text-xs sr-muted">{t('visitors.new.expectedArrival')}</p>
        </div>
      </ResidentConfirmDialog>

      <ResidentConfirmDialog
        open={cancelVisitorTarget !== null}
        title={t('visitors.cancelPassConfirmTitle')}
        description={t('visitors.cancelPassConfirmBody')}
        confirmLabel={t('visitors.cancelPassConfirm')}
        cancelLabel={t('actions.cancel')}
        onConfirm={() => void confirmCancelPass()}
        onCancel={() => setCancelVisitorTarget(null)}
        confirmPending={cancel.isPending}
        confirmVariant="destructive"
      />
    </ul>
  );
}

function FavouritesPanel({
  unitId,
  items,
  isLoading,
}: {
  unitId?: string;
  items: FavouriteVisitor[];
  isLoading: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const createFav = useCreateFavouriteVisitor(api);
  const deleteFav = useDeleteFavouriteVisitor(api);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  async function onSaveFavourite(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !name.trim() || !phone.trim()) return;
    try {
      await createFav.mutateAsync({
        unitId,
        name: name.trim(),
        phoneCountryCode: '+60',
        phone: phone.trim(),
        vehiclePlate: vehiclePlate.trim() || undefined,
        entryMode: vehiclePlate.trim() ? 'DRIVE_IN' : 'WALK_IN',
      });
      setName('');
      setPhone('');
      setVehiclePlate('');
      setShowForm(false);
      toast.success(t('visitors.favourites.savedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onPreFillFromFavourite(fav: FavouriteVisitor) {
    if (!fav.phone?.trim()) {
      toast.error(t('visitors.favourites.needPhone'));
      return;
    }
    const params = new URLSearchParams(favouriteToPreRegParams(fav));
    router.push(`/visitors/new?${params.toString()}`);
  }

  async function onDelete(id: string) {
    if (!unitId) return;
    try {
      await deleteFav.mutateAsync({ id, unitId });
      toast.success(t('visitors.favourites.removedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm sr-muted">{t('visitors.favourites.blurb')}</p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Heart className="size-4" />
          {showForm ? t('actions.cancel') : t('visitors.favourites.addCta')}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="flex flex-col gap-3" onSubmit={onSaveFavourite}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fav-name">{t('visitors.favourites.nameLabel')}</Label>
              <Input
                id="fav-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-phone">{t('visitors.favourites.phoneLabel')}</Label>
                <Input
                  id="fav-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-plate">{t('visitors.favourites.plateLabel')}</Label>
                <Input
                  id="fav-plate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createFav.isPending}>
                {t('visitors.favourites.saveCta')}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={t('visitors.favourites.emptyTitle')}
          description={t('visitors.favourites.emptyDesc')}
          action={
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              <Star className="size-4" />
              {t('visitors.favourites.emptyCta')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((fav) => (
            <Card key={fav.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{fav.name}</div>
                  <div className="text-xs sr-muted mt-0.5">
                    {[fav.phone, fav.vehiclePlate].filter(Boolean).join(' · ') ||
                      t('visitors.favourites.noContact')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => onPreFillFromFavourite(fav)}>
                    {t('visitors.preRegister')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${fav.name}`}
                    onClick={() => onDelete(fav.id)}
                    disabled={deleteFav.isPending}
                  >
                    <Trash2 className="size-4 sr-muted" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
