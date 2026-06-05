'use client';

import { api, readSession } from '@/lib/api';
import { RealtimeProvider } from '@smartresidence/api-client/realtime';
import * as React from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function WebRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);

  React.useEffect(() => {
    setHasToken(Boolean(readSession()?.accessToken));
  }, []);

  return (
    <RealtimeProvider api={api} baseUrl={baseUrl} enabled={hasToken}>
      {children}
    </RealtimeProvider>
  );
}
