import type { QueryClient } from '@tanstack/react-query';
import { api, writeSession } from './api';

/**
 * Fully ends the client session: revoke on the API, drop persisted tokens,
 * clear TanStack Query (stale `me` / condos caches caused wrong-role redirects),
 * then hard-navigate to sign-in so in-memory React state is discarded.
 */
export async function performSignOut(queryClient: QueryClient): Promise<void> {
  try {
    await api.signOut();
  } catch {
    /* ignore — still clear local state */
  }
  writeSession(null);
  queryClient.clear();
  if (typeof window !== 'undefined') {
    window.location.href = '/sign-in';
  }
}
