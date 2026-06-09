import { useMe, useThreads } from '@smartresidence/api-client';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Card,
  FadeInView,
  MetaLine,
  Pill,
  palette,
  radius,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  Pressable,
  type ListRenderItemInfo,
} from 'react-native';
import { api } from '../../../src/lib/api';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

const PRIORITY_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'success',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'neutral',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

const SLA_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  BREACHED: 'danger',
  AT_RISK: 'warning',
  ON_TRACK: 'success',
  NONE: 'neutral',
};

type FilterType = 'active' | 'mine' | 'closed' | 'all';

export default function HelpdeskInboxScreen() {
  const router = useRouter();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const threads = useThreads(api, { limit: 100 });

  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const items = threads.data?.items ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      if (activeFilter === 'active') {
        return t.status !== 'RESOLVED' && t.status !== 'CLOSED';
      }
      if (activeFilter === 'mine') {
        return t.assignedTo?.id === myId;
      }
      if (activeFilter === 'closed') {
        return t.status === 'RESOLVED' || t.status === 'CLOSED';
      }
      return true;
    });
  }, [items, activeFilter, myId]);

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([threads.refetch(), me.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [me, threads]);

  const renderFilterButton = useCallback((type: FilterType, label: string) => {
    const isActive = activeFilter === type;
    return (
      <Pressable
        onPress={() => setActiveFilter(type)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.md,
          backgroundColor: isActive ? palette.coralPrimary : '#E5E7EB',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 80,
        }}
      >
        <AppText
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: isActive ? '#FFFFFF' : palette.textLight,
          }}
        >
          {label}
        </AppText>
      </Pressable>
    );
  }, [activeFilter]);

  const keyExtractor = useCallback((item: (typeof filteredItems)[number]) => item.id, []);

  const renderItem = useCallback(
    ({ item: t, index }: ListRenderItemInfo<(typeof filteredItems)[number]>) => (
      <FadeInView index={index}>
        <AnimatedPressable onPress={() => router.push(`/(management)/helpdesk/${t.id}` as Href)}>
          <Card style={{ padding: 16 }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <AppText variant="label" numberOfLines={1}>
                    {t.subject}
                  </AppText>
                  <AppText variant="caption" style={{ color: palette.mutedLight, marginTop: 2 }}>
                    {t.createdBy ? `${t.createdBy.name} (${t.unit?.identifier ?? 'No unit'})` : 'Anonymous'}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Pill tone={PRIORITY_TONE[t.priority] ?? 'neutral'} label={t.priority} />
                  <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={t.status} />
                </View>
              </View>

              <AlignRow style={{ justifyContent: 'space-between', minHeight: 0, marginTop: 4 }}>
                <MetaLine
                  parts={[
                    t.category,
                    `${t._count?.messages ?? 0} msgs`,
                    `updated ${new Date(t.lastMessageAt).toLocaleDateString()}`,
                  ]}
                />
                {t.slaState && t.slaState !== 'NONE' ? (
                  <Pill tone={SLA_TONE[t.slaState] ?? 'neutral'} label={`SLA: ${t.slaState}`} />
                ) : null}
              </AlignRow>

              {t.assignedTo ? (
                <View style={{ borderTopWidth: 1, borderTopColor: palette.borderLight, paddingTop: 8, marginTop: 4 }}>
                  <AppText variant="caption" style={{ color: palette.mutedLight }}>
                    Assigned to: <AppText variant="caption" style={{ fontWeight: '600' }}>{t.assignedTo.name}</AppText>
                  </AppText>
                </View>
              ) : (
                <View style={{ borderTopWidth: 1, borderTopColor: palette.borderLight, paddingTop: 8, marginTop: 4 }}>
                  <AppText variant="caption" style={{ color: palette.mutedLight, fontStyle: 'italic' }}>
                    Unassigned - Tap to view & claim
                  </AppText>
                </View>
              )}
            </View>
          </Card>
        </AnimatedPressable>
      </FadeInView>
    ),
    [router],
  );

  const listHeader = (
    <View style={{ gap: 12 }}>
      <AppText variant="title">Helpdesk Inbox</AppText>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {renderFilterButton('active', 'Active')}
        {renderFilterButton('mine', 'Assigned to me')}
        {renderFilterButton('closed', 'Closed')}
        {renderFilterButton('all', 'All')}
      </View>
    </View>
  );

  const listEmpty = (
    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
      <AppText variant="meta">No tickets found in this view.</AppText>
    </View>
  );

  if (threads.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bgLight }}>
        <ActivityIndicator size="large" color={palette.coralPrimary} />
        <AppText variant="meta" style={{ marginTop: 8 }}>Loading tickets...</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bgLight }}>
      <FlatList
        data={filteredItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 12,
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} colors={[palette.coralPrimary]} />
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={false}
      />
    </View>
  );
}
