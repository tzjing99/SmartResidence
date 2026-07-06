import { Ionicons } from '@expo/vector-icons';
import {
  useCondoAnnouncements,
  useMe,
  useMyCondos,
  useMyUnits,
  useThreads,
  useUnitDefects,
  useUnitInvoices,
  useUnitVisitors,
} from '@smartresidence/api-client';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  formatMoney,
  invoiceOutstanding,
} from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Card,
  Pill,
  Stack,
  type ThemeColors,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useMemo } from 'react';
import {
  type DimensionValue,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { RESIDENT_THREAD_INBOX_PARAMS, countOpenThreads } from '../../src/lib/resident-threads';
import type { MeResponse } from '../../src/lib/roles';

type IconName = ComponentProps<typeof Ionicons>['name'];

const INACTIVE_INVOICE_STATUSES = new Set(['PAID', 'VOID']);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const condo = condos.data?.[0];
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const visitors = useUnitVisitors(api, unit?.id ?? null, 'upcoming');
  const defects = useUnitDefects(api, unit?.id ?? null);
  const threads = useThreads(api, RESIDENT_THREAD_INBOX_PARAMS);
  const announcements = useCondoAnnouncements(api, condo?.id ?? null);
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () =>
        Promise.all([
          me.refetch(),
          condos.refetch(),
          units.refetch(),
          invoices.refetch(),
          visitors.refetch(),
          defects.refetch(),
          threads.refetch(),
          announcements.refetch(),
        ]),
      [announcements, condos, defects, invoices, me, threads, units, visitors],
    ),
  );

  const openInvoice = (invoices.data?.items as any[] | undefined)?.find(
    (i) => !INACTIVE_INVOICE_STATUSES.has(i.status),
  );
  const upcomingVisitors = ((visitors.data?.items as any[]) ?? []).slice(0, 3);
  const openDefects = ((defects.data?.items as any[]) ?? []).filter(
    (d) => d.status !== 'CLOSED' && d.status !== 'RESOLVED',
  ).length;
  const openThreads = countOpenThreads(threads.data?.items);
  const announcement = announcements.data?.items?.[0];
  const hasRoomForColumns = width >= 380;
  const actionWidth: DimensionValue = hasRoomForColumns ? '48%' : '100%';
  const bottomPadding = Math.max(insets.bottom, 16) + 84;
  const homeLine = [
    unit ? `Unit ${unit.identifier}` : 'Finding your unit',
    condo?.name ?? 'SmartResidence',
  ].join(' · ');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 24, 36),
          paddingBottom: bottomPadding,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="caption" style={styles.eyebrow}>
            Resident home
          </AppText>
          <AppText numberOfLines={2} style={styles.title}>
            Welcome, {user?.name ?? 'Resident'}
          </AppText>
          <AppText numberOfLines={2} style={styles.homeLine}>
            {homeLine}
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/(resident)/sos' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS"
          style={styles.sosIconButton}
        >
          <Ionicons name="warning-outline" size={20} color="#DC2626" />
        </Pressable>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="card-outline" size={20} color={colors.coral} />
          </View>
          <Pill
            tone={
              openInvoice ? (openInvoice.status === 'OVERDUE' ? 'danger' : 'warning') : 'success'
            }
            label={openInvoice ? openInvoice.status.toLowerCase() : 'clear'}
          />
        </View>
        <AppText variant="meta" style={styles.cardMeta}>
          Maintenance fees
        </AppText>
        {openInvoice ? (
          <>
            <AppText style={styles.heroAmount}>
              {formatMoney(invoiceOutstanding(openInvoice), openInvoice.currencyCode ?? 'MYR')}
            </AppText>
            <AppText variant="meta" style={styles.cardSubcopy}>
              {openInvoice.number} · due {formatDate(openInvoice.dueDate)}
            </AppText>
          </>
        ) : (
          <>
            <AppText style={styles.heroAmount}>All clear</AppText>
            <AppText variant="meta" style={styles.cardSubcopy}>
              Nothing is due right now.
            </AppText>
          </>
        )}
        <AnimatedPressable
          onPress={() => router.push('/(resident)/billing' as Href)}
          contentStyle={styles.heroButton}
        >
          <AppText style={styles.heroButtonText}>
            {openInvoice ? 'Review and pay' : 'View fees'}
          </AppText>
        </AnimatedPressable>
      </Card>

      <View style={styles.sectionHeader}>
        <AppText variant="subheading">What do you need?</AppText>
        <AppText variant="meta" style={styles.sectionCopy}>
          Fast access to the things residents use most.
        </AppText>
      </View>

      <View style={styles.actionGrid}>
        <ActionTile
          icon="person-add-outline"
          title="Pre-register"
          subtitle="Invite a visitor"
          width={actionWidth}
          onPress={() => router.push('/(resident)/visitors/new' as Href)}
        />
        <ActionTile
          icon="chatbubbles-outline"
          title="Messages"
          subtitle={openThreads > 0 ? `${openThreads} open` : 'Ask management'}
          width={actionWidth}
          onPress={() => router.push('/(resident)/messages' as Href)}
        />
        <ActionTile
          icon="card-outline"
          title="Fees"
          subtitle={openInvoice ? 'Payment due' : 'All clear'}
          width={actionWidth}
          onPress={() => router.push('/(resident)/billing' as Href)}
        />
        <ActionTile
          icon="settings-outline"
          title="Settings"
          subtitle="Account and home"
          width={actionWidth}
          onPress={() => router.push('/(resident)/settings' as Href)}
        />
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="people-outline"
          label="Visitors"
          value={`${upcomingVisitors.length}`}
          detail={upcomingVisitors.length === 1 ? 'upcoming guest' : 'upcoming guests'}
          width={actionWidth}
          onPress={() => router.push('/(resident)/visitors' as Href)}
        />
        <SummaryCard
          icon="construct-outline"
          label="Defects"
          value={`${openDefects}`}
          detail={openDefects === 1 ? 'open report' : 'open reports'}
          width={actionWidth}
          onPress={() => router.push('/(resident)/defects' as Href)}
        />
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="subheading">Quick links</AppText>
        <AppText variant="meta" style={styles.sectionCopy}>
          More resident tools, one tap away.
        </AppText>
      </View>

      <View style={styles.actionGrid}>
        <ActionTile
          icon="notifications-outline"
          title="Notifications"
          subtitle="Alerts and updates"
          width={actionWidth}
          onPress={() => router.push('/(resident)/notifications' as Href)}
        />
        <ActionTile
          icon="podium-outline"
          title="MC polls"
          subtitle="Owner voting"
          width={actionWidth}
          onPress={() => router.push('/(resident)/polls' as Href)}
        />
        <ActionTile
          icon="search-outline"
          title="Lost & found"
          subtitle="Community board"
          width={actionWidth}
          onPress={() => router.push('/(resident)/lost-found' as Href)}
        />
        <ActionTile
          icon="hammer-outline"
          title="Governance"
          subtitle="AGM & EGM"
          width={actionWidth}
          onPress={() => router.push('/(resident)/governance' as Href)}
        />
        <ActionTile
          icon="calendar-outline"
          title="Facilities"
          subtitle="Book amenities"
          width={actionWidth}
          onPress={() => router.push('/(resident)/facilities' as Href)}
        />
        <ActionTile
          icon="document-text-outline"
          title="Forms"
          subtitle="Move-in & permits"
          width={actionWidth}
          onPress={() => router.push('/(resident)/forms' as Href)}
        />
        <ActionTile
          icon="help-circle-outline"
          title="Help & FAQ"
          subtitle="Find answers"
          width={actionWidth}
          onPress={() => router.push('/(resident)/faq' as Href)}
        />
        <ActionTile
          icon="key-outline"
          title="Unit access"
          subtitle="Who has access"
          width={actionWidth}
          onPress={() => router.push('/(resident)/access' as Href)}
        />
      </View>

      <Card style={styles.listCard}>
        <View style={styles.cardHeaderRow}>
          <View>
            <AppText variant="subheading">Upcoming visitors</AppText>
            <AppText variant="meta" style={styles.cardSubcopy}>
              Who the gate should expect next.
            </AppText>
          </View>
          <Pill tone="primary" label={`${upcomingVisitors.length}`} />
        </View>
        {upcomingVisitors.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={22} color={colors.muted} />
            <AppText style={styles.emptyTitle}>No guests scheduled</AppText>
            <AppText variant="meta" style={styles.emptyCopy}>
              Pre-register friends, family, or contractors before they arrive.
            </AppText>
          </View>
        ) : (
          <Stack gap={10}>
            {upcomingVisitors.map((v) => (
              <View key={v.id} style={styles.visitorRow}>
                <View style={styles.visitorAvatar}>
                  <Ionicons name="person-outline" size={18} color={colors.coral} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText numberOfLines={1} style={styles.visitorName}>
                    {v.name}
                  </AppText>
                  <AppText variant="meta" numberOfLines={1} style={styles.cardSubcopy}>
                    {formatDateTime(v.expectedAt)}
                    {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                  </AppText>
                </View>
              </View>
            ))}
          </Stack>
        )}
      </Card>

      <AnimatedPressable onPress={() => router.push('/(resident)/announcements' as Href)}>
        <Card style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons name="megaphone-outline" size={18} color={colors.coral} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="meta" style={styles.cardMeta}>
              Latest announcement
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              {announcement && !announcement.readByMe ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.coral,
                    marginTop: 8,
                  }}
                />
              ) : null}
              <AppText numberOfLines={2} style={[styles.noticeTitle, { flex: 1 }]}>
                {announcement?.title ?? 'No announcements yet.'}
              </AppText>
            </View>
            {announcement ? (
              <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Pill tone="neutral" label={ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]} />
                {announcement.importance !== 'INFO' ? (
                  <Pill
                    tone={announcement.importance === 'URGENT' ? 'danger' : 'warning'}
                    label={announcement.importance === 'URGENT' ? 'Urgent' : 'Important'}
                  />
                ) : null}
                {announcement.requiresAck && !announcement.ackedByMe ? (
                  <Pill tone="primary" label="Ack required" />
                ) : null}
              </View>
            ) : null}
          </View>
        </Card>
      </AnimatedPressable>
    </ScrollView>
  );
}

function ActionTile({
  icon,
  title,
  subtitle,
  width,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  width: DimensionValue;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);

  return (
    <AnimatedPressable onPress={onPress} style={{ width }} contentStyle={styles.actionTile}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.coral} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText numberOfLines={1} style={styles.actionTitle}>
          {title}
        </AppText>
        <AppText numberOfLines={1} variant="meta" style={styles.cardSubcopy}>
          {subtitle}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  width,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  width: DimensionValue;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);

  return (
    <AnimatedPressable onPress={onPress} style={{ width }} contentStyle={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <Ionicons name={icon} size={19} color={colors.coral} />
        <AppText variant="meta" style={styles.cardMeta}>
          {label}
        </AppText>
      </View>
      <AppText style={styles.summaryValue}>{value}</AppText>
      <AppText variant="meta" numberOfLines={1} style={styles.cardSubcopy}>
        {detail}
      </AppText>
    </AnimatedPressable>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function createHomeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    header: {
      paddingHorizontal: 2,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    sosIconButton: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.messageResidentBg,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 2,
    },
    eyebrow: {
      color: colors.coral,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.fg,
      fontSize: 30,
      lineHeight: 38,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    homeLine: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    heroCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    heroIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.full,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardMeta: {
      color: colors.muted,
      fontWeight: '600',
    },
    heroAmount: {
      color: colors.fg,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 2,
    },
    cardSubcopy: {
      color: colors.muted,
    },
    heroButton: {
      marginTop: spacing.sm,
      minHeight: 46,
      borderRadius: radius.xl,
      backgroundColor: colors.coral,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    heroButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    sectionHeader: {
      gap: 2,
      marginTop: spacing.xs,
    },
    sectionCopy: {
      color: colors.muted,
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    actionTile: {
      minHeight: 82,
      borderRadius: radius['2xl'],
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOpacity: colors.statusBarStyle === 'light' ? 0.2 : 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionTitle: {
      color: colors.fg,
      fontWeight: '700',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    summaryCard: {
      minHeight: 120,
      borderRadius: radius['2xl'],
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      justifyContent: 'space-between',
    },
    summaryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    summaryValue: {
      color: colors.fg,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
    },
    listCard: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    emptyState: {
      borderRadius: radius.xl,
      backgroundColor: colors.messageResidentBg,
      padding: spacing.md,
      alignItems: 'flex-start',
      gap: 6,
    },
    emptyTitle: {
      color: colors.fg,
      fontWeight: '700',
    },
    emptyCopy: {
      color: colors.muted,
    },
    visitorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.messageResidentBg,
      padding: spacing.sm,
    },
    visitorAvatar: {
      width: 38,
      height: 38,
      borderRadius: radius.full,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    visitorName: {
      color: colors.fg,
      fontWeight: '700',
    },
    noticeCard: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    noticeIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeTitle: {
      color: colors.fg,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      marginTop: 3,
    },
  });
}
