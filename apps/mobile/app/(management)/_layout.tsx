import { palette } from '@smartresidence/ui-mobile';
import { Stack } from 'expo-router';
import { RoleGuardGate } from '../../src/components/role-guard-gate';

export default function ManagementLayout() {
  return (
    <RoleGuardGate area="management">
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: palette.coralPrimary,
          headerStyle: { backgroundColor: palette.bgLight },
        }}
      >
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="helpdesk-settings" options={{ title: 'Helpdesk & SLA' }} />
        <Stack.Screen name="helpdesk/index" options={{ title: 'Helpdesk Inbox' }} />
        <Stack.Screen name="helpdesk/[id]" options={{ title: 'Ticket Detail' }} />
      </Stack>
    </RoleGuardGate>
  );
}
