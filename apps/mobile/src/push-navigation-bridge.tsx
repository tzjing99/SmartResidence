import Constants from 'expo-constants';
import { type Href, router } from 'expo-router';
import * as React from 'react';
import { resolveNotificationRoute } from './lib/push-navigation';
import { usePushRegistration } from './lib/use-push-registration';

const isExpoGo = Constants.appOwnership === 'expo';

type NotificationResponse = {
  notification?: { request?: { content?: { data?: Record<string, unknown> } } };
};

function navigateForResponse(response: NotificationResponse | null | undefined) {
  const data = response?.notification?.request?.content?.data;
  const route = resolveNotificationRoute(data);
  if (route) router.push(route as Href);
}

/**
 * Handles push-notification side effects: registers the device for push while a
 * session is active, and navigates via expo-router when the user taps a push
 * (both while running and from a cold start). No-ops safely in Expo Go.
 */
export function PushNavigationBridge() {
  usePushRegistration();

  React.useEffect(() => {
    if (isExpoGo) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        navigateForResponse(response as NotificationResponse);
      });

      // Cold start: the app was launched by tapping a notification.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!cancelled && last) navigateForResponse(last as NotificationResponse);

      cleanup = () => subscription.remove();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
