import { RealtimeProvider } from '@smartresidence/api-client/realtime';
import * as React from 'react';
import { api } from './lib/api';
import { getCachedSession, subscribeSession } from './lib/session';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export function MobileRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      void getCachedSession().then((s) => setHasToken(Boolean(s?.accessToken)));
    };
    sync();
    return subscribeSession(sync);
  }, []);

  return (
    <RealtimeProvider api={api} baseUrl={baseUrl} enabled={hasToken}>
      {children}
    </RealtimeProvider>
  );
}
