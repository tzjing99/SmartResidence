import * as React from 'react';
import { registerForPush } from './push';
import { getCachedSession, subscribeSession } from './session';

/**
 * Registers the device for push whenever there is an active session.
 *
 * Runs on mount (covers an already-signed-in user reopening the app) and on
 * every session change (covers a fresh sign-in). Registration only fires when a
 * session token is present, and we skip repeats for the same access token so we
 * don't spam the endpoint on unrelated session updates.
 */
export function usePushRegistration() {
  const lastTokenRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const sync = () => {
      void getCachedSession().then((session) => {
        const accessToken = session?.accessToken ?? null;
        if (!accessToken) {
          lastTokenRef.current = null;
          return;
        }
        if (lastTokenRef.current === accessToken) return;
        lastTokenRef.current = accessToken;
        void registerForPush();
      });
    };

    sync();
    return subscribeSession(sync);
  }, []);
}
