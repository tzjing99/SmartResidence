'use client';

import { PillTabs } from '@/components/pill-tabs';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useApproveVisitor,
  useCreateFavouriteVisitor,
  useCreateVisitor,
  useDeleteFavouriteVisitor,
  useFavouriteVisitors,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import type { FavouriteVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import type { VisitorPurpose } from '@smartresidence/shared-types';
import {
  canOneClickPreRegFromVisitor,
  defaultExpectedArrival,
  favouriteToPreRegParams,
  visitorToPreRegParams,
  VisitorPurpose as VisitorPurposeSchema,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Heart, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type VisitorTab = VisitorListView | 'favourites';

const SKELETON_KEYS = ['s1', 's2', 's3'];

function resolvePurposeForPreReg(purpose: string | null | undefined): VisitorPurpose {
  const parsed = VisitorPurposeSchema.safeParse(purpose);
  return parsed.success ? parsed.data : 'VISITOR';
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

      {tab === 'favourites' ? (
        <FavouritesPanel
          unitId={unit?.id}
          items={(favourites.data?.items ?? []) as FavouriteVisitor[]}
          isLoading={favourites.isLoading}
        />
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

  async function onApprove(id: string) {
    try {
      await approve.mutateAsync(id);
      toast.success('Visitor approved — guard may check them in');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onReject(id: string) {
    try {
      await reject.mutateAsync({ visitorId: id });
      toast.success('Visitor rejected');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onInviteAgain(v: Visitor) {
    if (!unitId) return;
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
    const entryMode = v.vehiclePlate?.trim() ? 'DRIVE_IN' : 'WALK_IN';
    try {
      const created = await create.mutateAsync({
        unitId,
        name: v.name,
        phone: v.phone.trim(),
        phoneCountryCode: v.phoneCountryCode ?? '+60',
        purpose: resolvePurposeForPreReg(v.purpose),
        entryMode,
        vehiclePlate: v.vehiclePlate?.trim() || undefined,
        expectedAt: defaultExpectedArrival(),
        overnight: false,
      });
      toast.success(t('visitors.inviteAgainSuccess'));
      router.push(`/visitors/${created.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      const params = new URLSearchParams(visitorToPreRegParams(v));
      router.push(`/visitors/new?${params.toString()}`);
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
            description: 'Pre-register a guest or approve a walk-in request.',
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
              description:
                'Past check-ins, expired passes, and declined walk-ins appear here.',
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
    <ul className="flex flex-col gap-3">
      {items.map((v) => (
        <Card key={v.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">{v.name}</div>
              <div className="text-xs sr-muted mt-0.5">
                {v.visitType === 'WALKIN_UNIT' ? 'Walk-in · ' : ''}
                {tab === 'live'
                  ? t('visitors.onSiteNow')
                  : tab === 'history' && v.status === 'CHECKED_OUT'
                    ? 'Visited'
                    : `Expected ${new Date(v.expectedAt).toLocaleString()}`}
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
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onReject(v.id)}
                    disabled={reject.isPending}
                  >
                    Reject
                  </Button>
                </div>
              ) : v.visitType === 'PRE_REG' && v.status === 'APPROVED' && tab === 'upcoming' ? (
                <Link
                  href={`/visitors/${v.id}`}
                  className="text-sm text-coral-500 hover:underline mt-2 inline-block"
                >
                  View pass →
                </Link>
              ) : tab === 'history' &&
                (v.status === 'CHECKED_OUT' || v.visitType === 'PRE_REG') ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => onInviteAgain(v)}
                  disabled={create.isPending}
                >
                  {t('visitors.inviteAgain')}
                </Button>
              ) : null}
            </div>
            <Badge tone={statusTone(v.status)}>{v.status.toLowerCase().replace(/_/g, ' ')}</Badge>
          </div>
        </Card>
      ))}
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
      toast.success('Favourite saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onPreFillFromFavourite(fav: FavouriteVisitor) {
    if (!fav.phone?.trim()) {
      toast.error('Add a phone number to this favourite for quick passes');
      return;
    }
    const params = new URLSearchParams(favouriteToPreRegParams(fav));
    router.push(`/visitors/new?${params.toString()}`);
  }

  async function onDelete(id: string) {
    if (!unitId) return;
    try {
      await deleteFav.mutateAsync({ id, unitId });
      toast.success('Removed from favourites');
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
        <p className="text-sm sr-muted">Saved profiles for one-tap pre-registration.</p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Heart className="size-4" />
          {showForm ? 'Cancel' : 'Add favourite'}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="flex flex-col gap-3" onSubmit={onSaveFavourite}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fav-name">Name</Label>
              <Input
                id="fav-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-phone">Phone</Label>
                <Input
                  id="fav-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fav-plate">Plate</Label>
                <Input
                  id="fav-plate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createFav.isPending}>
                Save favourite
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No favourites yet"
          description="Save frequent guests — family, cleaners, regular deliveries — for quick passes."
          action={
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              <Star className="size-4" />
              Add your first favourite
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
                      'No contact details'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => onPreFillFromFavourite(fav)}>
                    Pre-register
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

function statusTone(status: string) {
  switch (status) {
    case 'CHECKED_IN':
      return 'success' as const;
    case 'CHECKED_OUT':
      return 'neutral' as const;
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXPIRED':
      return 'danger' as const;
    case 'PENDING_OWNER_APPROVAL':
      return 'warning' as const;
    default:
      return 'primary' as const;
  }
}
