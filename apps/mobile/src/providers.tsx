import { useTheme } from '@smartresidence/ui-mobile';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from './i18n/locale-provider';
import { PushNavigationBridge } from './push-navigation-bridge';
import { MobileRealtimeProvider } from './realtime-provider';
import { MobileThemeProvider } from './theme-provider';
import '../global.css';

function ThemedStatusBar() {
  const { colors } = useTheme();
  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);
  return <StatusBar style={colors.statusBarStyle} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            // React Native treats AppState focus like window focus; background refetches
            // surfaced unwanted pull-to-refresh UI on screens using RefreshControl.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileThemeProvider>
          <QueryClientProvider client={client}>
            <LocaleProvider>
              <MobileRealtimeProvider>
                <PushNavigationBridge />
                <ThemedStatusBar />
                {children}
              </MobileRealtimeProvider>
            </LocaleProvider>
          </QueryClientProvider>
        </MobileThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
