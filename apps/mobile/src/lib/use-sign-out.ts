import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { performSignOut } from './sign-out';

export function useSignOut() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await performSignOut(queryClient);
    } finally {
      setBusy(false);
    }
  }, [queryClient]);

  return { signOut, busy };
}
