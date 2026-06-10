import type { AnnouncementSummary, ListAnnouncementsParams } from '@smartresidence/api-client';

/** Shared inbox params so home badge and announcements list use one React Query cache. */
export const RESIDENT_ANNOUNCEMENT_INBOX_PARAMS = { limit: 50 } satisfies ListAnnouncementsParams;

export function countUnreadAnnouncements(
  items: AnnouncementSummary[] | undefined,
  unreadCount?: number,
): number {
  if (typeof unreadCount === 'number') return unreadCount;
  return (items ?? []).filter((a) => !a.readAt).length;
}
