import { palette } from '@smartresidence/ui-mobile';
import { Stack } from 'expo-router';

export default function ManagementLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.coralPrimary,
        headerStyle: { backgroundColor: palette.bgLight },
      }}
    >
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="helpdesk-settings" options={{ title: 'Helpdesk & SLA' }} />
    </Stack>
  );
}
