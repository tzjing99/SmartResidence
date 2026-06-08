import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  vi.stubGlobal('window', { localStorage, location: { pathname: '/messages/new', href: '' } });
  return store;
}

const STORAGE_KEY = 'sr.session.v1';

describe('getValidAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the stored token when it is still valid', async () => {
    stubStorage();
    const { writeSession, getValidAccessToken } = await import('./api');
    writeSession({
      accessToken: 'fresh-token',
      refreshToken: 'r1',
      sessionId: 's1',
      expiresAt: Date.now() + 10 * 60 * 1000,
      activeCondoId: null,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(getValidAccessToken()).resolves.toBe('fresh-token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes and persists a new token when the stored one is expired', async () => {
    const store = stubStorage();
    const { writeSession, getValidAccessToken, readSession } = await import('./api');
    writeSession({
      accessToken: 'expired-token',
      refreshToken: 'r1',
      sessionId: 's1',
      expiresAt: Date.now() - 1000,
      activeCondoId: 'condo-1',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            accessToken: 'new-token',
            refreshToken: 'r2',
            expiresIn: 900,
            sessionId: 's1',
          },
        }),
      }),
    );

    await expect(getValidAccessToken()).resolves.toBe('new-token');
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
    const persisted = readSession();
    expect(persisted?.accessToken).toBe('new-token');
    expect(persisted?.refreshToken).toBe('r2');
    expect(persisted?.activeCondoId).toBe('condo-1');
    expect(store.get(STORAGE_KEY)).toContain('new-token');
  });

  it('deduplicates concurrent refreshes into a single network call', async () => {
    stubStorage();
    const { writeSession, getValidAccessToken } = await import('./api');
    writeSession({
      accessToken: 'expired-token',
      refreshToken: 'r1',
      sessionId: 's1',
      expiresAt: Date.now() - 1000,
      activeCondoId: null,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'new-token',
        refreshToken: 'r2',
        expiresIn: 900,
        sessionId: 's1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([getValidAccessToken(), getValidAccessToken()]);
    expect(a).toBe('new-token');
    expect(b).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to the existing token when refresh fails', async () => {
    stubStorage();
    const { writeSession, getValidAccessToken } = await import('./api');
    writeSession({
      accessToken: 'expired-token',
      refreshToken: 'r1',
      sessionId: 's1',
      expiresAt: Date.now() - 1000,
      activeCondoId: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(getValidAccessToken()).resolves.toBe('expired-token');
  });
});
