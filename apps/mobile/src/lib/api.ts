import { createApiClient } from '@smartresidence/api-client';
import { getCachedSession, setCached, writeSession } from './session';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = createApiClient({
  baseUrl,
  getAccessToken: async () => (await getCachedSession())?.accessToken ?? null,
  getActiveCondoId: async () => (await getCachedSession())?.activeCondoId ?? null,
  onUnauthorized: async () => {
    const session = await getCachedSession();
    if (!session?.refreshToken) {
      await writeSession(null);
      setCached(null);
    }
  },
});
