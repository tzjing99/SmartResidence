import { Stack } from 'expo-router';

export default function VisitorsStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ headerShown: true, title: 'Pre-register visitor' }} />
    </Stack>
  );
}
