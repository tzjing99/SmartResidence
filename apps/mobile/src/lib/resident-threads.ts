import type { ListThreadsParams, ThreadSummary } from '@smartresidence/api-client';

/** Shared inbox params so home badge and messages list use one React Query cache. */
export const RESIDENT_THREAD_INBOX_PARAMS = { limit: 50 } satisfies ListThreadsParams;

const CLOSED_STATUSES = new Set(['CLOSED', 'RESOLVED']);

export function countOpenThreads(items: ThreadSummary[] | undefined): number {
  return (items ?? []).filter((t) => !CLOSED_STATUSES.has(t.status)).length;
}
