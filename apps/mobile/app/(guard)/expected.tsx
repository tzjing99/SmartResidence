import { Ionicons } from '@expo/vector-icons';
import { useGuardAcknowledgeWalkIn, useMyCondos } from '@smartresidence/api-client';
import type { GuardExpectedVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import { guardCanAcknowledgeWalkIn } from '@smartresidence/shared-types';
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
import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GUARD_CARD_BORDER,
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_SOFT_SKY,
  GuardHeader,
  guardStyles,
  plainLabel,
} from '../../src/components/guard-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

type ExpectedTab = 'expected' | 'no_show' | 'history';

const TAB_VIEWS: Record<ExpectedTab, VisitorListView> = {
  expected: 'expected',
  no_show: 'no_show',
  history: 'history',
};

const TAB_LABELS: Record<ExpectedTab, string> = {
  expected: 'Expected',
  no_show: 'No-shows',
  history: 'History',
};

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function isToday(date: Date, now = new Date()): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatVisitTime(date: Date): string {
  return TIME_FORMATTER.format(date).replace(/\s/g, '\u00A0');
}

function visitDateLabel(date: Date): string {
  return isToday(date) ? 'Today' : SHORT_DATE_FORMATTER.format(date);
}

function visitMetaPrefix(variant: ExpectedTab): string {
  switch (variant) {
    case 'expected':
      return 'Due';
    case 'no_show':
      return 'Missed';
    case 'history':
      return 'Visited';
  }
}

function visitTypeLabel(visitType: string): string {
  switch (visitType) {
    case 'PRE_REG':
      return 'Pre-registered';
    case 'WALKIN_UNIT':
      return 'Walk-in';
    case 'WALKIN_OFFICE':
      return 'Management office';
    default:
      return plainLabel(visitType);
  }
}

function getArrivalHighlight(expectedAt: Date, now = Date.now()): 'soon' | 'overdue' | null {
  const ms = expectedAt.getTime() - now;
  if (ms < 0) return 'overdue';
  if (ms <= 30 * 60 * 1000) return 'soon';
  return null;
}

/**
 * Only scheduled pre-registrations have a meaningful arriving-soon/overdue window.
 * Walk-ins are already at the gate (expectedAt = registration time) and on-site/terminal
 * visitors are never overdue.
 */
function getVisitorArrivalHighlight(
  visitor: Pick<GuardExpectedVisitor, 'expectedAt' | 'visitType' | 'status'>,
  now = Date.now(),
): 'soon' | 'overdue' | null {
  if (visitor.visitType !== 'PRE_REG') return null;
  if (visitor.status !== 'APPROVED' && visitor.status !== 'PENDING_MANAGEMENT_APPROVAL') {
    return null;
  }
  return getArrivalHighlight(new Date(visitor.expectedAt), now);
}

function arrivalLabel(highlight: 'soon' | 'overdue' | null, expectedAt: Date): string | null {
  if (!highlight) return null;
  if (highlight === 'overdue') return 'Overdue';
  const minutes = Math.max(0, Math.round((expectedAt.getTime() - Date.now()) / 60_000));
  return minutes <= 1 ? 'Arriving soon' : `Arriving in ${minutes}m`;
}

function toCardVisitor(
  v: GuardExpectedVisitor | (Visitor & { unit?: { identifier?: string } }),
): GuardExpectedVisitor {
  if ('unitLabel' in v && v.unitLabel !== undefined) {
    return v as GuardExpectedVisitor;
  }
  const visitor = v as Visitor & { unit?: { identifier?: string } };
  return {
    id: visitor.id,
    name: visitor.name,
    expectedAt: visitor.expectedAt,
    vehiclePlate: visitor.vehiclePlate,
    visitType: visitor.visitType,
    status: visitor.status,
    unitLabel: visitor.unit?.identifier ?? null,
    overnight: visitor.overnight,
  };
}

function ExpectedVisitorCard({
  visitor,
  variant,
  onAcknowledgeWalkIn,
  acknowledging,
}: {
  visitor: GuardExpectedVisitor;
  variant: ExpectedTab;
  onAcknowledgeWalkIn?: (visitorId: string, name: string) => void;
  acknowledging?: boolean;
}) {
  const expectedAt = new Date(visitor.expectedAt);
  const highlight = variant === 'expected' ? getVisitorArrivalHighlight(visitor) : null;
  const chip = variant === 'expected' ? arrivalLabel(highlight, expectedAt) : null;
  const timeLabel = formatVisitTime(expectedAt);
  const dateLabel = visitDateLabel(expectedAt);
  const metaPrefix = visitMetaPrefix(variant);
  const canAcknowledge =
    variant === 'expected' && guardCanAcknowledgeWalkIn(visitor) && onAcknowledgeWalkIn;

  return (
    <Card
      style={[
        guardStyles.card,
        styles.visitorCard,
        highlight === 'soon' ? styles.soonCard : null,
        highlight === 'overdue' ? styles.overdueCard : null,
        variant === 'no_show' ? styles.mutedCard : null,
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleBlock}>
          <AppText numberOfLines={2} style={styles.visitorName}>
            {visitor.name}
          </AppText>
          <AppText variant="meta" numberOfLines={2} style={styles.cardMeta}>
            {visitor.unitLabel ?? 'Unit not shown'}
          </AppText>
          <View style={styles.pillRow}>
            <Pill tone="neutral" label={visitTypeLabel(visitor.visitType)} />
            {visitor.vehiclePlate ? <Pill tone="info" label={visitor.vehiclePlate} /> : null}
            {visitor.overnight ? <Pill tone="warning" label="Overnight" /> : null}
            {chip ? (
              <Pill tone={highlight === 'overdue' ? 'warning' : 'primary'} label={chip} />
            ) : variant === 'no_show' ? (
              <Pill tone="neutral" label="No-show" />
            ) : variant === 'history' ? (
              <Pill tone="neutral" label={plainLabel(visitor.status)} />
            ) : null}
          </View>
        </View>
        <View style={styles.visitMetaBadge}>
          <AppText variant="caption" numberOfLines={1} style={styles.visitMetaPrefix}>
            {metaPrefix}
          </AppText>
          <AppText variant="meta" numberOfLines={1} style={styles.visitMetaDate}>
            {dateLabel}
          </AppText>
          <AppText numberOfLines={1} style={styles.timeValue}>
            {timeLabel}
          </AppText>
        </View>
      </View>
      {canAcknowledge ? (
        <View style={styles.ackRow}>
          <Button
            title="Acknowledge entry"
            size="sm"
            loading={acknowledging}
            onPress={() => onAcknowledgeWalkIn?.(visitor.id, visitor.name)}
          />
          <AppText variant="meta" style={styles.cardMeta}>
            Owner approved in the app — record entry without a pass scan.
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

export default function ExpectedScreen() {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, horizontalPadding, twoColumn } = useTabletLayout();
  const [tab, setTab] = useState<ExpectedTab>('expected');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const acknowledgeWalkIn = useGuardAcknowledgeWalkIn(api);

  const visitors = useQueries({
    queries: (['expected', 'no_show', 'history'] as ExpectedTab[]).map((id) => ({
      queryKey: ['guard', 'visitors', condo?.id, id],
      queryFn: () =>
        condo
          ? api.visitorsForCondo(condo.id, { view: TAB_VIEWS[id], limit: 50 })
          : Promise.resolve({ items: [], total: 0 }),
      refetchInterval: 30_000,
      enabled: Boolean(condo),
    })),
  });
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () => Promise.all([condos.refetch(), ...visitors.map((query) => query.refetch())]),
      [condos, visitors],
    ),
  );

  const tabIndex = tab === 'expected' ? 0 : tab === 'no_show' ? 1 : 2;
  const activeQuery = visitors[tabIndex];
  const items = useMemo(
    () =>
      (
        (activeQuery?.data?.items ?? []) as Array<
          GuardExpectedVisitor | (Visitor & { unit?: { identifier?: string } })
        >
      ).map(toCardVisitor),
    [activeQuery?.data?.items],
  );

  const counts = visitors.map((q) => q.data?.total ?? 0);

  const handleAcknowledgeWalkIn = useCallback(
    async (visitorId: string, name: string) => {
      try {
        await acknowledgeWalkIn.mutateAsync(visitorId);
        Alert.alert('Acknowledged', `${name} recorded on site.`);
        await Promise.all(visitors.map((q) => q.refetch()));
      } catch (err) {
        Alert.alert('Could not acknowledge', (err as Error).message);
      }
    },
    [acknowledgeWalkIn, visitors],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GuardExpectedVisitor>) => (
      <View style={twoColumn ? styles.gridItem : styles.listItem}>
        <ExpectedVisitorCard
          visitor={item}
          variant={tab}
          onAcknowledgeWalkIn={handleAcknowledgeWalkIn}
          acknowledging={acknowledgeWalkIn.isPending}
        />
      </View>
    ),
    [tab, twoColumn, handleAcknowledgeWalkIn, acknowledgeWalkIn.isPending],
  );

  const listHeader = (
    <View style={styles.headerStack}>
      <GuardHeader
        eyebrow="Guard arrivals"
        title="Expected visitors"
        subtitle="Review approved visitors, missed arrivals, and recent guardhouse history."
      />
      <View style={styles.tabRail}>
        {(['expected', 'no_show', 'history'] as ExpectedTab[]).map((id, i) => {
          const active = tab === id;
          const count = counts[i] ?? 0;
          const label = count > 0 ? `${TAB_LABELS[id]} (${count})` : TAB_LABELS[id];
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tabButton, active ? styles.tabButtonActive : null]}
            >
              <AppText style={[styles.tabText, active ? styles.tabTextActive : null]}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Card style={[guardStyles.card, styles.contextCard]}>
        <View style={styles.contextIcon}>
          <Ionicons
            name={
              tab === 'expected'
                ? 'calendar-outline'
                : tab === 'no_show'
                  ? 'time-outline'
                  : 'archive-outline'
            }
            size={19}
            color={GUARD_CORAL}
          />
        </View>
        <View style={styles.contextCopy}>
          <AppText style={styles.contextTitle}>{TAB_LABELS[tab]}</AppText>
          <AppText variant="meta" style={styles.cardMeta}>
            {tab === 'expected'
              ? 'Visitors due soon stay easy to spot.'
              : tab === 'no_show'
                ? 'Expired passes that did not check in.'
                : 'Recent visitors and completed gate activity.'}
          </AppText>
        </View>
        <Pill tone="primary" label={`${counts[tabIndex] ?? 0}`} />
      </Card>
      {activeQuery?.isLoading ? (
        <AppText variant="meta" style={styles.cardMeta}>
          Loading visitors...
        </AppText>
      ) : null}
    </View>
  );

  const emptyState = activeQuery?.isLoading ? null : (
    <EmptyState
      title={
        tab === 'history'
          ? 'No visitor history'
          : tab === 'no_show'
            ? 'No expired passes today'
            : 'No visitors expected today'
      }
    />
  );

  return (
    <FlatList
      key={twoColumn ? 'tablet-grid' : 'phone-list'}
      data={activeQuery?.isLoading ? [] : items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={twoColumn ? 2 : 1}
      style={{ flex: 1, backgroundColor: palette.bgLight }}
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
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyState}
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
  tabRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tabButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: palette.surfaceLight,
    borderWidth: 1,
    borderColor: GUARD_CARD_BORDER,
  },
  tabButtonActive: {
    backgroundColor: GUARD_SOFT_CORAL,
    borderColor: 'rgba(255,90,95,0.32)',
  },
  tabText: {
    color: palette.mutedLight,
    fontWeight: '700',
  },
  tabTextActive: {
    color: GUARD_CORAL,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  contextIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_SKY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCopy: {
    flex: 1,
    minWidth: 0,
  },
  contextTitle: {
    color: palette.textLight,
    fontWeight: '800',
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
    padding: spacing.md,
  },
  soonCard: {
    borderColor: 'rgba(255,90,95,0.32)',
    backgroundColor: 'rgba(255,241,240,0.82)',
  },
  overdueCard: {
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(254,243,199,0.38)',
  },
  mutedCard: {
    opacity: 0.94,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visitMetaBadge: {
    minWidth: 88,
    maxWidth: 108,
    borderRadius: radius.xl,
    backgroundColor: palette.bgLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  visitMetaPrefix: {
    color: palette.mutedLight,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  visitMetaDate: {
    color: palette.mutedLight,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    marginTop: 1,
  },
  timeValue: {
    color: palette.textLight,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
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
  ackRow: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: GUARD_CARD_BORDER,
  },
});
