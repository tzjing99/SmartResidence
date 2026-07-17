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
  defaultExpectedArrival,
  favouriteToPreRegParams,
  formatMalaysiaPhoneDisplay,
  visitorToCreateInput,
  visitorToPreRegParams,
} from '@smartresidence/shared-types';
import {
  Button,
  Card,
  EmptyState,
  Pill,
  SkeletonList,
  radius,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { ArrearsAccessBanner } from '../../../src/components/arrears-access-banner';
import { DeliveryPassForm } from '../../../src/components/delivery-pass-form';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  useResidentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { VisitorPassCard } from '../../../src/components/visitor-pass-card';
import { useT } from '../../../src/i18n/locale-provider';
import { alertResidentMutationError, isArrearsAccessError } from '../../../src/lib/access-restriction-error';
import { api } from '../../../src/lib/api';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

type VisitorTab = VisitorListView | 'favourites';

export default function VisitorsScreen() {
  const t = useT();
  const router = useRouter();
  const { twoColumn } = useTabletLayout();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const [tab, setTab] = useState<VisitorTab>('upcoming');
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const liveVisitors = useUnitVisitors(api, unit?.id ?? null, 'live');
  const liveCount = liveVisitors.data?.total ?? 0;
  const tabs = useMemo<{ id: VisitorTab; label: string }[]>(
    () => [
      { id: 'upcoming', label: t('visitors.tabs.upcoming') },
      {
        id: 'live',
        label:
          liveCount > 0
            ? t('mobile.visitors.onSiteNowCount', { count: liveCount })
            : t('visitors.onSiteNow'),
      },
      { id: 'history', label: t('visitors.tabs.history') },
      { id: 'favourites', label: t('visitors.tabs.favourites') },
    ],
    [liveCount, t],
  );
  const listView: VisitorListView | undefined =
    tab === 'upcoming' || tab === 'history' || tab === 'live' ? tab : undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null, listView);
  const favourites = useFavouriteVisitors(api, tab === 'favourites' ? (unit?.id ?? null) : null);
  const listLoading = units.isPending || visitors.isLoading;
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () =>
        Promise.all([
          units.refetch(),
          liveVisitors.refetch(),
          tab === 'favourites' ? favourites.refetch() : visitors.refetch(),
        ]),
      [favourites, liveVisitors, tab, units, visitors],
    ),
  );
  const handlePreRegisterFavourite = useCallback(
    (fav: FavouriteVisitor) => {
      if (!fav.phone?.trim()) {
        Alert.alert(
          t('mobile.visitors.phoneRequiredTitle'),
          t('mobile.visitors.phoneRequiredBody'),
        );
        return;
      }
      const qs = new URLSearchParams(favouriteToPreRegParams(fav)).toString();
      router.push(`/(resident)/visitors/new?${qs}` as Href);
    },
    [router, t],
  );

  return (
    <ResidentScreen
      eyebrow={t('visitors.title')}
      title={t('nav.screens.visitors')}
      subtitle={t('visitors.subtitle')}
      scrollProps={{ refreshControl }}
      headerAction={
        <View style={{ gap: 8 }}>
          <Button
            title={t('mobile.visitors.preRegisterCta')}
            size="lg"
            onPress={() => router.push('/(resident)/visitors/new' as Href)}
          />
          <Button
            title={t('mobile.visitors.recurringPasses')}
            size="sm"
            variant="secondary"
            onPress={() => router.push('/(resident)/visitors/recurring' as Href)}
          />
        </View>
      }
    >
      <ArrearsAccessBanner />
      <Card style={[styles.card, { padding: 8 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.coralSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? `${colors.coral}40` : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: active ? colors.coral : colors.muted,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <DeliveryPassForm unitId={unit?.id} />

      {tab === 'favourites' ? (
        <FavouritesTab
          unitId={unit?.id}
          items={(favourites.data?.items ?? []) as FavouriteVisitor[]}
          onPreRegister={handlePreRegisterFavourite}
        />
      ) : (
        <VisitorsTab
          tab={tab}
          unitId={unit?.id}
          items={(visitors.data?.items ?? []) as Visitor[]}
          isLoading={listLoading}
          twoColumn={twoColumn}
        />
      )}
    </ResidentScreen>
  );
}

function VisitorsTab({
  tab,
  unitId,
  items,
  isLoading,
  twoColumn,
}: {
  tab: VisitorListView;
  unitId?: string;
  items: Visitor[];
  isLoading: boolean;
  twoColumn?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const fieldStyle = useMemo(
    () => ({
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.fg,
    }),
    [colors],
  );
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);
  const create = useCreateVisitor(api);
  const cancelPass = useCancelVisitor(api);
  const [inviteAgainVisitor, setInviteAgainVisitor] = useState<Visitor | null>(null);
  const [inviteExpectedAt, setInviteExpectedAt] = useState<Date>(() => defaultExpectedArrival());

  function openInviteAgain(v: Visitor) {
    if (!canOneClickPreRegFromVisitor(v)) {
      const qs = new URLSearchParams(visitorToPreRegParams(v)).toString();
      router.push(`/(resident)/visitors/new?${qs}` as Href);
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
      router.push(`/(resident)/visitors/${created.id}` as Href);
    } catch (err) {
      alertResidentMutationError(err, {
        title: t('mobile.visitors.couldNotInvite'),
        arrearsTitle: t('billing.accessRestrictedTitle'),
        arrearsBody: t('billing.accessRestrictedBody'),
        payLabel: t('billing.accessRestrictedPay'),
        dismissLabel: t('billing.accessRestrictedDismiss'),
        onPay: () => router.push('/(resident)/billing' as Href),
      });
      const qs = new URLSearchParams(visitorToPreRegParams(inviteAgainVisitor)).toString();
      setInviteAgainVisitor(null);
      if (!isArrearsAccessError(err)) {
        router.push(`/(resident)/visitors/new?${qs}` as Href);
      }
    }
  }

  function promptCancelPass(v: Visitor) {
    Alert.alert(t('visitors.cancelPassConfirmTitle'), t('visitors.cancelPassConfirmBody'), [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('visitors.cancelPassConfirm'),
        style: 'destructive',
        onPress: () => {
          if (!unitId) return;
          void cancelPass
            .mutateAsync({ visitorId: v.id, unitId })
            .catch((err) =>
              Alert.alert(t('mobile.visitors.couldNotCancel'), (err as Error).message),
            );
        },
      },
    ]);
  }

  async function onApprove(id: string) {
    try {
      await approve.mutateAsync(id);
      hapticSuccess();
      Alert.alert(t('mobile.visitors.approvedTitle'), t('mobile.visitors.approvedBody'));
    } catch (err) {
      hapticError();
      Alert.alert(t('mobile.visitors.couldNotApprove'), (err as Error).message);
    }
  }

  async function onReject(id: string) {
    try {
      await reject.mutateAsync({ visitorId: id });
      hapticSuccess();
      Alert.alert(t('mobile.visitors.rejectedTitle'), t('mobile.visitors.rejectedBody'));
    } catch (err) {
      hapticError();
      Alert.alert(t('mobile.visitors.couldNotReject'), (err as Error).message);
    }
  }

  if (isLoading) {
    return <SkeletonList rows={3} rowHeight={88} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={
          tab === 'upcoming'
            ? t('visitors.emptyUpcoming')
            : tab === 'live'
              ? t('visitors.emptyLive')
              : t('visitors.emptyHistory')
        }
        description={
          tab === 'upcoming'
            ? t('visitors.emptyUpcomingHint')
            : tab === 'live'
              ? t('visitors.emptyLiveHint')
              : t('visitors.emptyHistoryHint')
        }
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((v) => {
        const canOpenPass =
          tab === 'upcoming' && v.visitType === 'PRE_REG' && v.status === 'APPROVED';
        return (
          <View
            key={v.id}
            style={{
              width: twoColumn ? '48%' : '100%',
              flexGrow: 1,
              minWidth: twoColumn ? 280 : undefined,
            }}
          >
            <VisitorPassCard
              visitor={v}
              tab={tab}
              pressable={canOpenPass}
              onPress={
                canOpenPass ? () => router.push(`/(resident)/visitors/${v.id}` as Href) : undefined
              }
              onApprove={() => onApprove(v.id)}
              onReject={() => onReject(v.id)}
              onCancel={() => promptCancelPass(v)}
              onInviteAgain={() => openInviteAgain(v)}
            />
          </View>
        );
      })}

      <Modal
        visible={inviteAgainVisitor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteAgainVisitor(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setInviteAgainVisitor(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: 20,
              gap: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.fg }}>
              {t('visitors.inviteAgainConfirmTitle')}
            </Text>
            {inviteAgainVisitor ? (
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
                {inviteAgainVisitor.name}
                {(() => {
                  const phone = formatMalaysiaPhoneDisplay(
                    inviteAgainVisitor.phone,
                    inviteAgainVisitor.phoneCountryCode,
                  );
                  return phone ? ` · ${phone}` : '';
                })()}
              </Text>
            ) : null}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fg }}>
                {t('visitors.inviteAgainSessionQuestion')}
              </Text>
              <TextInput
                value={
                  inviteExpectedAt instanceof Date && !Number.isNaN(inviteExpectedAt.getTime())
                    ? inviteExpectedAt.toISOString().slice(0, 16).replace('T', ' ')
                    : ''
                }
                onChangeText={(v) => {
                  const parsed = new Date(v.replace(' ', 'T'));
                  if (!Number.isNaN(parsed.getTime())) setInviteExpectedAt(parsed);
                }}
                style={fieldStyle}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                title={t('actions.cancel')}
                size="sm"
                variant="secondary"
                onPress={() => setInviteAgainVisitor(null)}
              />
              <Button
                title={t('visitors.inviteAgainConfirm')}
                size="sm"
                loading={create.isPending}
                onPress={() => void confirmInviteAgain()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FavouritesTab({
  unitId,
  items,
  onPreRegister,
}: {
  unitId?: string;
  items: FavouriteVisitor[];
  onPreRegister: (fav: FavouriteVisitor) => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const fieldStyle = useMemo(
    () => ({
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.fg,
    }),
    [colors],
  );
  const createFav = useCreateFavouriteVisitor(api);
  const deleteFav = useDeleteFavouriteVisitor(api);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');

  async function onSave() {
    if (!unitId || !name.trim() || !phone.trim()) return;
    try {
      await createFav.mutateAsync({
        unitId,
        name: name.trim(),
        phoneCountryCode: '+60',
        phone: phone.trim(),
        vehiclePlate: plate.trim() || undefined,
        entryMode: plate.trim() ? 'DRIVE_IN' : 'WALK_IN',
      });
      setName('');
      setPhone('');
      setPlate('');
      setShowForm(false);
      Alert.alert(t('mobile.visitors.savedTitle'), t('mobile.visitors.savedBody'));
    } catch (err) {
      Alert.alert(t('mobile.visitors.couldNotSave'), (err as Error).message);
    }
  }

  async function onDelete(id: string) {
    if (!unitId) return;
    try {
      await deleteFav.mutateAsync({ id, unitId });
    } catch (err) {
      Alert.alert(t('mobile.visitors.couldNotRemove'), (err as Error).message);
    }
  }

  return (
    <>
      <ResidentSectionHeader
        title={t('visitors.tabs.favourites')}
        subtitle={t('visitors.favourites.blurb')}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title={showForm ? t('actions.cancel') : t('visitors.favourites.addCta')}
          size="sm"
          variant="secondary"
          onPress={() => setShowForm((v) => !v)}
        />
      </View>

      {showForm ? (
        <Card style={[styles.card, { gap: 10 }]}>
          <Text style={{ fontWeight: '700', color: colors.fg }}>
            {t('visitors.favourites.addCta')}
          </Text>
          <TextInput
            placeholder={t('visitors.favourites.nameLabel')}
            value={name}
            onChangeText={setName}
            style={fieldStyle}
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder={t('visitors.favourites.phoneLabel')}
            value={phone}
            onChangeText={setPhone}
            style={[fieldStyle, { marginTop: 10 }]}
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder={t('visitors.favourites.plateLabel')}
            value={plate}
            onChangeText={setPlate}
            style={[fieldStyle, { marginTop: 10 }]}
            placeholderTextColor={colors.muted}
          />
          <View style={{ marginTop: 12 }}>
            <Button
              title={t('visitors.favourites.saveCta')}
              loading={createFav.isPending}
              onPress={onSave}
            />
          </View>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={t('visitors.favourites.emptyTitle')}
          description={t('visitors.favourites.emptyDesc')}
        />
      ) : (
        items.map((fav) => (
          <Card key={fav.id} style={styles.card}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontWeight: '700', color: colors.fg, fontSize: 16 }}
                  numberOfLines={2}
                >
                  {fav.name}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 18 }}
                  numberOfLines={2}
                >
                  {[formatMalaysiaPhoneDisplay(fav.phone, fav.phoneCountryCode), fav.vehiclePlate]
                    .filter(Boolean)
                    .join(' · ') || t('visitors.favourites.noContact')}
                </Text>
                {fav.entryMode ? (
                  <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                    <Pill tone="neutral" label={prettyLabel(fav.entryMode)} />
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 8, minWidth: 132, flexGrow: 1 }}>
                <Button
                  title={t('visitors.preRegister')}
                  size="sm"
                  onPress={() => onPreRegister(fav)}
                />
                <Button
                  title={t('actions.delete')}
                  size="sm"
                  variant="ghost"
                  onPress={() => onDelete(fav.id)}
                />
              </View>
            </View>
          </Card>
        ))
      )}
    </>
  );
}
