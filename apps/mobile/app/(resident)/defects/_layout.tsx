import { Stack } from 'expo-router';

export default function DefectsStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="package/[id]" />
    </Stack>
  );
}
