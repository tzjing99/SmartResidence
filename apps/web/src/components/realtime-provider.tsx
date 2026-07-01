'use client';

import { api, readSession } from '@/lib/api';
import { webHrefForNotification } from '@/lib/notification-href';
import { toast } from '@/lib/toast';
import {
  type NotificationSocketPayload,
  RealtimeProvider,
} from '@smartresidence/api-client/realtime';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function WebRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setHasToken(Boolean(readSession()?.accessToken));
  }, []);

  const handleNotification = React.useCallback(
    (payload: NotificationSocketPayload) => {
      const title = payload.title ?? 'New notification';
      const href = webHrefForNotification(payload);
      toast.message(title, {
        description: payload.body,
        ...(href
          ? {
              action: {
                label: 'View',
                onClick: () => router.push(href),
              },
            }
          : {}),
      });
    },
    [router],
  );

  return (
    <RealtimeProvider
      api={api}
      baseUrl={baseUrl}
      enabled={hasToken}
      onNotification={handleNotification}
    >
      {children}
    </RealtimeProvider>
  );
}
