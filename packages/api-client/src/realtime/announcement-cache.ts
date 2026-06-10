import type { QueryClient } from '@tanstack/react-query';
import type { AnnouncementListResult, AnnouncementSummary } from '../client';

export function patchAnnouncementReadInListCaches(
  qc: QueryClient,
  announcementId: string,
  readAt: string = new Date().toISOString(),
) {
  qc.setQueriesData<AnnouncementListResult>({ queryKey: ['announcements', 'condo'] }, (old) => {
    if (!old || !Array.isArray(old.items)) return old;
    const wasUnread = old.items.some((a) => a.id === announcementId && !a.readAt);
    return {
      ...old,
      unreadCount: wasUnread ? Math.max(0, (old.unreadCount ?? 0) - 1) : old.unreadCount,
      items: old.items.map((a) => (a.id === announcementId ? { ...a, readAt } : a)),
    };
  });
}

export function patchAnnouncementInListCaches(qc: QueryClient, summary: AnnouncementSummary) {
  qc.setQueriesData<AnnouncementListResult>({ queryKey: ['announcements', 'condo'] }, (old) => {
    if (!old || !Array.isArray(old.items)) return old;
    const idx = old.items.findIndex((a) => a.id === summary.id);
    if (idx === -1) return old;
    const items = [...old.items];
    items[idx] = { ...items[idx], ...summary };
    return { ...old, items };
  });
}
