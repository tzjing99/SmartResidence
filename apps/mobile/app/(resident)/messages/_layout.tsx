import { Stack } from 'expo-router';
import { useT } from '../../../src/i18n/locale-provider';

export default function MessagesStackLayout() {
  const t = useT();

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{ headerShown: true, title: t('nav.screens.conversation') }}
      />
      <Stack.Screen
        name="new"
        options={{ headerShown: true, title: t('nav.screens.newMessage') }}
      />
    </Stack>
  );
}
