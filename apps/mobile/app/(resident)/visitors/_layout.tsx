import { Stack } from 'expo-router';
import { useT } from '../../../src/i18n/locale-provider';

export default function VisitorsStackLayout() {
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
        options={{ headerShown: true, title: t('nav.screens.visitorPass') }}
      />
      <Stack.Screen
        name="new"
        options={{ headerShown: true, title: t('nav.screens.preRegisterVisitor') }}
      />
      <Stack.Screen
        name="recurring"
        options={{ headerShown: true, title: t('nav.screens.recurringPasses') }}
      />
    </Stack>
  );
}
