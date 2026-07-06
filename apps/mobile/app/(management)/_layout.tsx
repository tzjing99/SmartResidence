import { palette } from '@smartresidence/ui-mobile';
import { Stack } from 'expo-router';
import { RoleGuardGate } from '../../src/components/role-guard-gate';
import { useT } from '../../src/i18n/locale-provider';

export default function ManagementLayout() {
  const t = useT();

  return (
    <RoleGuardGate area="management">
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: palette.coralPrimary,
          headerStyle: { backgroundColor: palette.bgLight },
        }}
      >
        <Stack.Screen name="settings" options={{ title: t('admin.nav.settings') }} />
        <Stack.Screen name="helpdesk-settings" options={{ title: t('admin.nav.helpdesk') }} />
        <Stack.Screen name="helpdesk/index" options={{ title: t('admin.nav.helpdesk') }} />
        <Stack.Screen name="helpdesk/[id]" options={{ title: t('admin.nav.helpdesk') }} />
      </Stack>
    </RoleGuardGate>
  );
}
