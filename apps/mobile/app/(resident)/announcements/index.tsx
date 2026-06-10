import {
  useCondoAnnouncements,
  useMyCondos,
  type AnnouncementSummary,
} from '@smartresidence/api-client';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Card,
  EmptyState,
  FadeInView,
  MetaLine,
  Pill,
  palette,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  ResidentScreen,
  RESIDENT_CORAL,
  residentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { api } from '../../../src/lib/api';
import {
  RESIDENT_ANNOUNCEMENT_INBOX_PARAMS,
  countUnreadAnnouncements,
} from '../../../src/lib/resident-announcements';

const IMPORTANCE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  IMPORTANT: 'warning',
  INFO: 'info',
};

const CATEGORY_LABEL: Record<string, string> = {
  NOTICE: 'Notice',
  DOCUMENT: 'Document',
  MAINTENANCE: 'Maintenance',
};

export default function AnnouncementsScreen() {
  const router = useRouter();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useCondoAnnouncements(api, condo?.id ?? null, RESIDENT_ANNOUNCEMENT_INBOX_PARAMS);
  const { refreshControl } = usePullToRefresh(useCallback(() => list.refetch(), [list]));
  const items = list.data?.items ?? [];
  const unread = countUnreadAnnouncements(items, list.data?.unreadCount);

  return (
    <ResidentScreen
      eyebrow="Announcements"
      title="Building news"
      subtitle={
        unread > 0 ? `${unread} unread announcement${unread === 1 ? '' : 's'}` : 'Updates from management'
      }
      scrollProps={{ refreshControl }}
    >
      {list.isLoading && !list.data ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading announcements...
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState title="No announcements" description="Management notices will appear here." />
      ) : (
        items.map((item, index) => (
          <AnnouncementRow
            key={item.id}
            item={item}
            index={index}
            onPress={() => router.push(`/(resident)/announcements/${item.id}` as Href)}
          />
        ))
      )}
    </ResidentScreen>
  );
}

function AnnouncementRow({
  item,
  index,
  onPress,
}: {
  item: AnnouncementSummary;
  index: number;
  onPress: () => void;
}) {
  return (
    <FadeInView index={index}>
      <AnimatedPressable onPress={onPress} style={{ marginBottom: 12 }}>
        <Card style={[residentStyles.card, { padding: 16 }]}>
          <AlignRow style={{ alignItems: 'flex-start', minHeight: 0, flexWrap: 'wrap' }} gap={12}>
            {!item.readAt ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: RESIDENT_CORAL,
                  marginTop: 6,
                }}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <AppText variant="label" numberOfLines={2}>
                {item.title}
              </AppText>
              <MetaLine
                parts={[
                  item.publishedAt ? new Date(item.publishedAt).toLocaleString() : 'Recently',
                  item.pinned ? 'Pinned' : null,
                ].filter(Boolean) as string[]}
              />
              <AlignRow gap={8} style={{ flexWrap: 'wrap', marginTop: 4 }}>
                <Pill tone="neutral" label={CATEGORY_LABEL[item.category] ?? item.category} />
                <Pill
                  tone={IMPORTANCE_TONE[item.importance] ?? 'info'}
                  label={item.importance.toLowerCase()}
                />
              </AlignRow>
            </View>
          </AlignRow>
        </Card>
      </AnimatedPressable>
    </FadeInView>
  );
}
