'use client';

import { createApiClient } from '@smartresidence/api-client';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const STORAGE_KEY = 'sr.session.v1';

interface PersistedSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: number;
  activeCondoId?: string | null;
}

export function readSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: PersistedSession | null) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function setActiveCondo(condoId: string | null) {
  const session = readSession();
  if (!session) return;
  writeSession({ ...session, activeCondoId: condoId });
}

export const api = createApiClient({
  baseUrl,
  getAccessToken: () => readSession()?.accessToken ?? null,
  getActiveCondoId: () => readSession()?.activeCondoId ?? null,
  onUnauthorized: async () => {
    const session = readSession();
    if (!session?.refreshToken) {
      writeSession(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.href = '/sign-in';
      }
      return;
    }
  },
});
