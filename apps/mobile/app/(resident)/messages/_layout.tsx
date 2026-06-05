import { Stack } from 'expo-router';

export default function MessagesStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Conversation' }} />
      <Stack.Screen name="new" options={{ headerShown: true, title: 'New message' }} />
    </Stack>
  );
}
