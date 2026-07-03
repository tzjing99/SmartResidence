import { useCondoAnnouncements, useMyCondos } from '@smartresidence/api-client';
import type { AnnouncementCategory } from '@smartresidence/shared-types';
import { EmptyState, FadeInView, SkeletonList, Stack, spacing } from '@smartresidence/ui-mobile';
import { useCallback, useState } from 'react';
import {
  AnnouncementCategoryFilter,
  AnnouncementListRow,
} from '../../../src/components/announcements-ui';
import { ResidentScreen } from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { useT } from '../../../src/i18n/locale-provider';
import { api } from '../../../src/lib/api';

export default function AnnouncementsScreen() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [categoryFilter, setCategoryFilter] = useState<AnnouncementCategory | ''>('');
  const list = useCondoAnnouncements(api, condo?.id ?? null, {
    category: categoryFilter || undefined,
  });
  const { refreshControl } = usePullToRefresh(useCallback(() => list.refetch(), [list]));

  const items = list.data?.items ?? [];

  return (
    <ResidentScreen
      eyebrow={t('nav.sections.notices')}
      title={t('nav.screens.announcements')}
      subtitle="Official memos and updates from your management office."
      scrollProps={{ refreshControl }}
    >
      <AnnouncementCategoryFilter value={categoryFilter} onChange={setCategoryFilter} />

      {list.isLoading && !list.data ? (
        <SkeletonList rows={4} rowHeight={80} />
      ) : list.isError ? (
        <EmptyState
          title="Couldn't load notices"
          description="Pull down to refresh and try again."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={categoryFilter ? 'Nothing in this category' : 'Nothing new'}
          description={
            categoryFilter
              ? 'Try another category or check back later.'
              : 'Announcements will show up here.'
          }
        />
      ) : (
        <Stack gap={spacing.sm}>
          {items.map((item, index) => (
            <FadeInView key={item.id} index={index}>
              <AnnouncementListRow item={item} />
            </FadeInView>
          ))}
        </Stack>
      )}
    </ResidentScreen>
  );
}
