import * as SecureStore from 'expo-secure-store';

const KEY = 'sr.session.v1';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: number;
  activeCondoId?: string | null;
}

export async function readSession(): Promise<SessionData | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: SessionData | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(KEY);
    cached = null;
  } else {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    cached = session;
  }
  notifySessionListeners();
}

let cached: SessionData | null = null;

type SessionListener = () => void;
const listeners = new Set<SessionListener>();

function notifySessionListeners() {
  for (const listener of listeners) listener();
}

/** Subscribe to in-memory session changes (sign-in / sign-out). */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getCachedSession(): Promise<SessionData | null> {
  if (cached) return cached;
  cached = await readSession();
  return cached;
}

export function setCached(session: SessionData | null) {
  cached = session;
  notifySessionListeners();
}
