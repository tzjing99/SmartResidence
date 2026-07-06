import { Ionicons } from '@expo/vector-icons';
import { useCheckOutVisitor, useGuardLiveVisitors, useMyCondos } from '@smartresidence/api-client';
import {
  formatMalaysiaPhoneDisplay,
  guardCanCheckOutVisitor,
  malaysiaPhoneTelHref,
  pickOwnerPhone,
} from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import { useCallback } from 'react';
import { Alert, FlatList, Linking, type ListRenderItemInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_SOFT_SKY,
  GuardHeader,
  guardStyles,
} from '../../src/components/guard-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

function formatTimeOnSite(checkedInAt: Date, t: ReturnType<typeof useT>, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - checkedInAt.getTime()) / 60_000));
  if (mins < 1) return t('mobile.guard.live.justIn');
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function visitTypeLabel(visitType: string, t: ReturnType<typeof useT>): string {
  switch (visitType) {
    case 'PRE_REG':
      return t('visitors.guard.visitTypePreReg');
    case 'WALKIN_UNIT':
      return t('visitors.guard.visitTypeWalkInUnit');
    case 'WALKIN_OFFICE':
      return t('visitors.guard.visitTypeWalkInOffice');
    default:
      return visitType;
  }
}

export default function LiveScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, horizontalPadding, twoColumn } = useTabletLayout();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const live = useGuardLiveVisitors(api, condo?.id);
  const checkOut = useCheckOutVisitor(api);
  const items = live.data?.items ?? [];
  const { refreshControl } = usePullToRefresh(
    useCallback(() => Promise.all([condos.refetch(), live.refetch()]), [condos, live]),
  );

  const callPhone = useCallback((phone: string) => {
    const href = malaysiaPhoneTelHref(phone);
    if (href) void Linking.openURL(href);
  }, []);

  const confirmCheckOut = useCallback(
    (visitorId: string, name: string) => {
      Alert.alert(t('mobile.guard.live.checkOutTitle'), t('mobile.guard.live.checkOutBody'), [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('mobile.guard.live.checkOutYes'),
          style: 'destructive',
          onPress: () => {
            void checkOut.mutateAsync(visitorId).then(
              () =>
                Alert.alert(
                  t('mobile.guard.live.checkedOutTitle'),
                  t('mobile.guard.live.checkedOutMessage', { name }),
                ),
              (err: Error) => Alert.alert(t('mobile.guard.live.checkOutFailedTitle'), err.message),
            );
          },
        },
      ]);
    },
    [checkOut, t],
  );

  const renderItem = useCallback(
    ({ item: v }: ListRenderItemInfo<(typeof items)[number]>) => {
      const owner = pickOwnerPhone(v.ownerContacts);
      const checkedInAt = new Date(v.checkedInAt);
      const visitorPhone = formatMalaysiaPhoneDisplay(v.phone);
      const ownerPhone = owner?.phone ? formatMalaysiaPhoneDisplay(owner.phone) : null;
      const canCheckOut = guardCanCheckOutVisitor(v);
      return (
        <View style={twoColumn ? styles.gridItem : styles.listItem}>
          <Card style={[guardStyles.card, styles.visitorCard]}>
            <View style={styles.cardTopRow}>
              <View style={styles.visitorIcon}>
                <Ionicons name="person-outline" size={20} color={GUARD_CORAL} />
              </View>
              <View style={styles.cardTitleBlock}>
                <AppText numberOfLines={2} style={styles.visitorName}>
                  {v.name}
                </AppText>
                <AppText variant="meta" numberOfLines={2} style={styles.cardMeta}>
                  {v.unitLabel ?? t('mobile.guard.live.unitNotShown')} ·{' '}
                  {t('mobile.guard.live.onSiteMeta')} {formatTimeOnSite(checkedInAt, t)}
                </AppText>
                <View style={styles.pillRow}>
                  <Pill tone="neutral" label={visitTypeLabel(v.visitType, t)} />
                  {v.overnight ? <Pill tone="warning" label="Overnight" /> : null}
                  {v.vehiclePlate ? <Pill tone="neutral" label={v.vehiclePlate} /> : null}
                </View>
              </View>
            </View>
            <View style={styles.actionRow}>
              {visitorPhone ? (
                <Button
                  title={`Call visitor ${visitorPhone}`}
                  size="sm"
                  variant="soft-sky"
                  style={styles.actionButton}
                  onPress={() => callPhone(v.phone!)}
                />
              ) : null}
              {ownerPhone ? (
                <Button
                  title={`Call ${owner?.name}`}
                  size="sm"
                  variant="secondary"
                  style={styles.actionButton}
                  onPress={() => callPhone(owner?.phone!)}
                />
              ) : null}
              {canCheckOut ? (
                <Button
                  title={t('visitors.guard.checkOut')}
                  size="sm"
                  variant="soft-primary"
                  loading={checkOut.isPending}
                  style={styles.actionButton}
                  onPress={() => confirmCheckOut(v.id, v.name)}
                />
              ) : (
                <Pill tone="neutral" label="Record only" />
              )}
            </View>
          </Card>
        </View>
      );
    },
    [callPhone, checkOut.isPending, confirmCheckOut, twoColumn, t],
  );

  return (
    <FlatList
      key={twoColumn ? 'tablet-grid' : 'phone-list'}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={twoColumn ? 2 : 1}
      style={guardStyles.screen}
      contentContainerStyle={{
        width: '100%',
        maxWidth: contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: horizontalPadding,
        paddingTop: Math.max(insets.top + 24, 36),
        paddingBottom: Math.max(insets.bottom, 16) + 96,
        gap: spacing.md,
      }}
      columnWrapperStyle={twoColumn ? styles.columnWrapper : undefined}
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <GuardHeader
            eyebrow={t('mobile.guard.live.eyebrow')}
            title={t('visitors.guard.liveTitle')}
            subtitle="Active visitors currently inside the property. Walk-ins are record-only and close automatically at end of day."
          />
          <Card style={[guardStyles.card, styles.summaryCard]}>
            <View style={styles.summaryIcon}>
              <Ionicons name="people-outline" size={20} color={GUARD_CORAL} />
            </View>
            <View style={styles.summaryCopy}>
              <AppText style={styles.summaryValue}>
                {live.isLoading ? '—' : (live.data?.total ?? 0)}
              </AppText>
              <AppText variant="meta" style={styles.cardMeta}>
                {live.data?.total === 1 ? 'visitor on site' : 'visitors on site'}
              </AppText>
            </View>
            <Pill
              tone={items.length > 0 ? 'success' : 'neutral'}
              label={items.length > 0 ? 'Live' : 'Clear'}
            />
          </Card>
        </View>
      }
      ListEmptyComponent={
        live.isLoading ? null : (
          <EmptyState
            title={t('visitors.guard.liveEmpty')}
            description="Checked-in pre-registered visitors appear here. Walk-ins are logged for the record and close automatically."
          />
        )
      }
      refreshControl={refreshControl}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  headerStack: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryValue: {
    color: palette.textLight,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  gridItem: {
    flex: 1,
    minWidth: 280,
  },
  listItem: {
    flex: 1,
  },
  columnWrapper: {
    gap: spacing.md,
  },
  visitorCard: {
    gap: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  visitorIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_SKY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  visitorName: {
    color: palette.textLight,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  cardMeta: {
    color: palette.mutedLight,
    lineHeight: 19,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 132,
  },
});
