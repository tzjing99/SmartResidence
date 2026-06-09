import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { MobileArea } from '../lib/roles';
import { useRoleGuard } from '../lib/use-role-guard';

export function RoleGuardGate({
  area,
  children,
}: {
  area: MobileArea;
  children: ReactNode;
}) {
  const { ready } = useRoleGuard(area);
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF5A5F" />
      </View>
    );
  }
  return <>{children}</>;
}
