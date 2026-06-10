import Constants from 'expo-constants';
import * as Device from 'expo-device';

const isExpoGo = Constants.appOwnership === 'expo';

let handlerConfigured = false;

async function ensureNotificationHandler() {
  if (isExpoGo || handlerConfigured) return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

/** Register for Expo push notifications and ship the token to the API. */
export async function registerForPush(): Promise<string | null> {
  if (isExpoGo || !Device.isDevice) return null;

  await ensureNotificationHandler();
  const Notifications = await import('expo-notifications');

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  try {
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/notifications/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'EXPO', token }),
    });
  } catch {
    /* offline-tolerant: try again on next app open */
  }
  return token;
}
