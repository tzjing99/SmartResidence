'use client';

import { AppToaster } from '@/components/app-toaster';
import { WebRealtimeProvider } from '@/components/realtime-provider';
import { LocaleProvider } from '@/i18n/locale-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import dynamic from 'next/dynamic';
import * as React from 'react';

// Lazily load devtools so the (sizeable) bundle is split into its own chunk and
// is only ever fetched in development — it never ships in the production build.
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        <LocaleProvider>
          <WebRealtimeProvider>{children}</WebRealtimeProvider>
        </LocaleProvider>
        <AppToaster />
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
