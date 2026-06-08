import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, writeSession } from './api';
import { performSignOut } from './sign-out';

vi.mock('./api', () => ({
  api: { signOut: vi.fn() },
  writeSession: vi.fn(),
}));

describe('performSignOut', () => {
  beforeEach(() => {
    vi.mocked(api.signOut).mockResolvedValue(undefined);
    vi.mocked(writeSession).mockClear();
  });

  it('revokes session, clears storage, wipes query cache, and hard-redirects', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me'], { user: { id: 'owner', activeRole: 'UNIT_OWNER' } });
    queryClient.setQueryData(['condos', 'mine'], [{ id: 'c1' }]);

    const location = { href: '/dashboard' };
    vi.stubGlobal('window', { location });

    await performSignOut(queryClient);

    expect(api.signOut).toHaveBeenCalledOnce();
    expect(writeSession).toHaveBeenCalledWith(null);
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(queryClient.getQueryData(['condos', 'mine'])).toBeUndefined();
    expect(location.href).toBe('/sign-in');
  });

  it('still clears local state when the API sign-out fails', async () => {
    vi.mocked(api.signOut).mockRejectedValue(new Error('network'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me'], { user: { id: 'owner' } });
    const location = { href: '/admin' };
    vi.stubGlobal('window', { location });

    await performSignOut(queryClient);

    expect(writeSession).toHaveBeenCalledWith(null);
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(location.href).toBe('/sign-in');
  });
});
