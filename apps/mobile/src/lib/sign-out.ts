import type { QueryClient } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { api } from './api';
import { setCached, writeSession } from './session';

/** Ends the mobile session: revoke on API, clear SecureStore + query cache, navigate to sign-in. */
export async function performSignOut(queryClient: QueryClient): Promise<void> {
  try {
    await api.signOut();
  } catch {
    /* still clear local state */
  }
  await writeSession(null);
  setCached(null);
  queryClient.clear();
  router.replace('/sign-in' as Href);
}
