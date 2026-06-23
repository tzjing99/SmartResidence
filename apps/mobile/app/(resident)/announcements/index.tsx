import {
  useCondoAnnouncements,
  useMarkAnnouncementRead,
  useMyCondos,
} from '@smartresidence/api-client';
import type { Announcement } from '@smartresidence/shared-types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  announcementExcerpt,
  isPdfMime,
} from '@smartresidence/shared-types';
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
  spacing,
} from '@smartresidence/ui-mobile';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import {
  ResidentScreen,
  residentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { api } from '../../../src/lib/api';

const CORAL = '#FF385C';

function AnnouncementRow({ item }: { item: Announcement }) {
  const router = useRouter();
  const markRead = useMarkAnnouncementRead(api);
  const hasPdf = item.attachments?.some((a) => isPdfMime(a.mimeType));

  useEffect(() => {
    if (!item.readByMe) {
      markRead.mutate(item.id);
    }
  }, [item.id, item.readByMe]);

  return (
    <AnimatedPressable onPress={() => router.push(`/(resident)/announcements/${item.id}` as Href)}>
      <Card style={[residentStyles.card, { padding: 16, gap: spacing.sm }]}>
        <AlignRow style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText variant="label" numberOfLines={2}>
              {item.title}
            </AppText>
            <MetaLine
              parts={[
                ANNOUNCEMENT_CATEGORY_LABELS[item.category],
                item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '',
              ].filter(Boolean)}
            />
          </View>
          <AlignRow gap={6}>
            {!item.readByMe ? <Pill tone="primary" label="new" /> : null}
            {item.pinned ? <Pill tone="info" label="pinned" /> : null}
            {item.importance !== 'INFO' ? (
              <Pill
                tone={item.importance === 'URGENT' ? 'danger' : 'warning'}
                label={item.importance.toLowerCase()}
              />
            ) : null}
          </AlignRow>
        </AlignRow>
        <AppText variant="meta" numberOfLines={2} style={{ color: palette.mutedLight }}>
          {announcementExcerpt(item.body, 100)}
        </AppText>
        {hasPdf ? (
          <AlignRow gap={6} style={{ marginTop: 4 }}>
            <Ionicons name="document-text-outline" size={16} color={CORAL} />
            <AppText variant="meta" style={{ color: CORAL, fontWeight: '600' }}>
              Official memo attached
            </AppText>
          </AlignRow>
        ) : null}
      </Card>
    </AnimatedPressable>
  );
}

export default function AnnouncementsScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useCondoAnnouncements(api, condo?.id ?? null);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => list.refetch(), [list]),
  );

  const items = list.data?.items ?? [];

  return (
    <ResidentScreen
      eyebrow="Announcements"
      title="Management notices"
      subtitle="Official memos and updates from your condo management."
      scrollProps={{ refreshControl }}
    >
      {list.isLoading && !list.data ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading notices...
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState title="No announcements" description="Notices from management will appear here." />
      ) : (
        items.map((item, index) => (
          <FadeInView key={item.id} index={index}>
            <AnnouncementRow item={item} />
          </FadeInView>
        ))
      )}
    </ResidentScreen>
  );
}
