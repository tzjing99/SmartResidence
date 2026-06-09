import { useMyCondos } from '@smartresidence/api-client';
import type { GuardExpectedVisitor, Visitor, VisitorListView } from '@smartresidence/shared-types';
import { EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItemInfo } from 'react-native';
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

function visitTypeLabel(visitType: string): string {
  switch (visitType) {
    case 'PRE_REG':
      return 'Pre-registered';
    case 'WALKIN_UNIT':
      return 'Walk-in';
    case 'WALKIN_OFFICE':
      return 'Management office';
    default:
      return visitType;
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
}: {
  visitor: GuardExpectedVisitor;
  variant: ExpectedTab;
}) {
  const expectedAt = new Date(visitor.expectedAt);
  const highlight = variant === 'expected' ? getVisitorArrivalHighlight(visitor) : null;
  const chip = variant === 'expected' ? arrivalLabel(highlight, expectedAt) : null;
  const timeLabel = expectedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor:
          highlight === 'soon'
            ? 'rgba(255,90,60,0.35)'
            : highlight === 'overdue'
              ? 'rgba(245,158,11,0.4)'
              : palette.borderLight,
        backgroundColor:
          variant === 'no_show'
            ? 'rgba(255,255,255,0.6)'
            : highlight === 'soon'
              ? 'rgba(255,90,60,0.04)'
              : highlight === 'overdue'
                ? 'rgba(245,158,11,0.05)'
                : '#fff',
        padding: 16,
        opacity: variant === 'no_show' ? 0.92 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{visitor.name}</Text>
          <Text style={{ color: palette.mutedLight, fontSize: 13, marginTop: 4 }}>
            {visitor.unitLabel ?? '—'}
          </Text>
          <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 6 }}>
            {timeLabel} · {visitTypeLabel(visitor.visitType)}
            {visitor.vehiclePlate ? ` · ${visitor.vehiclePlate}` : ''}
          </Text>
          {visitor.overnight ? (
            <View style={{ marginTop: 8 }}>
              <Pill tone="neutral" label="Overnight" />
            </View>
          ) : null}
        </View>
        {chip ? (
          <Pill tone={highlight === 'overdue' ? 'warning' : 'primary'} label={chip} />
        ) : variant === 'no_show' ? (
          <Pill tone="neutral" label="No-show" />
        ) : null}
      </View>
    </View>
  );
}

export default function ExpectedScreen() {
  const { contentMaxWidth, horizontalPadding, twoColumn } = useTabletLayout();
  const [tab, setTab] = useState<ExpectedTab>('expected');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

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
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GuardExpectedVisitor>) => (
      <View style={{ flex: 1, minWidth: twoColumn ? 280 : undefined }}>
        <ExpectedVisitorCard visitor={item} variant={tab} />
      </View>
    ),
    [tab, twoColumn],
  );

  const listHeader = (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Expected visitors</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 14, marginBottom: 4 }}>
        Who&apos;s arriving today — acknowledge anticipated visitors and review no-shows.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['expected', 'no_show', 'history'] as ExpectedTab[]).map((id, i) => {
          const active = tab === id;
          const count = counts[i] ?? 0;
          const label = count > 0 ? `${TAB_LABELS[id]} (${count})` : TAB_LABELS[id];
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? 'rgba(255,90,60,0.12)' : 'transparent',
                borderWidth: 1,
                borderColor: active ? 'rgba(255,90,60,0.35)' : palette.borderLight,
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: active ? palette.coralPrimary : palette.mutedLight,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activeQuery?.isLoading ? <Text style={{ color: palette.mutedLight }}>Loading…</Text> : null}
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
        paddingVertical: 20,
        paddingBottom: 40,
        gap: 12,
      }}
      columnWrapperStyle={twoColumn ? { gap: 12 } : undefined}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyState}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}
