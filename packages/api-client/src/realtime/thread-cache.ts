import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient, ThreadDetail, ThreadSummary } from '../client';
import { queryKeys } from '../hooks/index';

export interface ThreadSocketPayload {
  condoId: string;
  threadId: string;
  messageId?: string;
}

/** Merge a thread summary into every cached inbox list query. */
export function patchThreadInListCaches(qc: QueryClient, summary: ThreadSummary) {
  qc.setQueriesData<{ items: ThreadSummary[]; total: number }>({ queryKey: ['threads'] }, (old) => {
    // The ['threads'] prefix also matches the thread *detail* cache (['threads', id]),
    // whose shape is ThreadDetail (no `items`). Only touch real inbox list caches.
    if (!old || !Array.isArray(old.items)) return old;
    const idx = old.items.findIndex((t) => t.id === summary.id);
    if (idx === -1) {
      return { items: [summary, ...old.items], total: old.total + 1 };
    }
    const items = [...old.items];
    items[idx] = { ...items[idx], ...summary };
    return { ...old, items };
  });
}

/**
 * Fetch a single thread and merge into detail + inbox caches.
 * Skips the network round-trip when the message is already present (e.g. optimistic send).
 */
export async function syncThreadFromSocket(
  qc: QueryClient,
  api: ApiClient,
  payload: ThreadSocketPayload,
) {
  const { threadId, messageId } = payload;
  const cached = qc.getQueryData<ThreadDetail>(queryKeys.thread(threadId));
  if (messageId && cached?.messages.some((m) => m.id === messageId)) {
    return;
  }
  if (messageId && cached?.messages.some((m) => m.id.startsWith('optimistic-'))) {
    // Optimistic bubble in flight — server event will reconcile on mutation success.
    return;
  }

  const detail = await qc.fetchQuery({
    queryKey: queryKeys.thread(threadId),
    queryFn: () => api.thread(threadId),
    staleTime: 0,
  });
  patchThreadInListCaches(qc, detail);
}
