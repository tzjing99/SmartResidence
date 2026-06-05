import { api } from './lib/api';
import { getCachedSession } from './lib/session';
import { RealtimeProvider } from '@smartresidence/api-client';
import * as React from 'react';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export function MobileRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);

  React.useEffect(() => {
    void getCachedSession().then((s) => setHasToken(Boolean(s?.accessToken)));
  }, []);

  return (
    <RealtimeProvider api={api} baseUrl={baseUrl} enabled={hasToken}>
      {children}
    </RealtimeProvider>
  );
}
