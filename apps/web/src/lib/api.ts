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

// Refresh access tokens slightly before they actually expire so an in-flight
// request never races the 15-minute JWT TTL.
const TOKEN_EXPIRY_SKEW_MS = 30_000;

// Deduplicate concurrent refreshes: if several requests fire while the token is
// expired, they all await the same refresh instead of stampeding the endpoint.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a fresh access token. Uses a bare
 * `fetch` (not the shared {@link api} client) so it never recurses back through
 * `getAccessToken`. Persists the rotated tokens on success.
 */
async function refreshAccessToken(session: PersistedSession): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: RefreshResult;
    } & Partial<RefreshResult>;
    const result = (json.data ?? json) as RefreshResult;
    if (!result?.accessToken) return null;
    writeSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
      expiresAt: Date.now() + result.expiresIn * 1000,
      activeCondoId: session.activeCondoId ?? null,
    });
    return result.accessToken;
  } catch {
    return null;
  }
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

/**
 * Returns a valid access token, transparently refreshing it first when the
 * persisted token is expired (or within the skew window). Without this, a token
 * that lapsed while the user was composing — e.g. on the new-message page —
 * would be sent as-is and the API would reject it with
 * "Invalid or expired access token".
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session?.accessToken) return null;
  const stillValid = session.expiresAt - Date.now() > TOKEN_EXPIRY_SKEW_MS;
  if (stillValid || !session.refreshToken) return session.accessToken;
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(session).finally(() => {
      refreshInFlight = null;
    });
  }
  // Fall back to the existing token if the refresh fails — the 401 handler
  // below will then redirect to sign-in.
  return (await refreshInFlight) ?? session.accessToken;
}

export const api = createApiClient({
  baseUrl,
  getAccessToken: () => getValidAccessToken(),
  getSessionId: () => readSession()?.sessionId ?? null,
  getActiveCondoId: () => readSession()?.activeCondoId ?? null,
  onUnauthorized: async () => {
    const session = readSession();
    // A 401 despite a refresh token usually means the access token was revoked
    // or the clock skewed past expiry — try one refresh so the next request
    // succeeds before giving up and bouncing to sign-in.
    if (session?.refreshToken) {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken(session).finally(() => {
          refreshInFlight = null;
        });
      }
      const refreshed = await refreshInFlight;
      if (refreshed) return;
    }
    writeSession(null);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
      window.location.href = '/sign-in';
    }
  },
});
