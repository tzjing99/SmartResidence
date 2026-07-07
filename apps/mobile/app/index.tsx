import { queryKeys } from '@smartresidence/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { api } from '../src/lib/api';
import { getActiveRole, roleToHomePath } from '../src/lib/roles';
import { getCachedSession } from '../src/lib/session';

export default function Bootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const session = await getCachedSession();
      if (!mounted) return;
      if (!session?.accessToken) {
        router.replace('/sign-in');
        return;
      }
      try {
        const me = await api.me();
        queryClient.setQueryData(queryKeys.me, me);
        router.replace(roleToHomePath(getActiveRole(me)));
      } catch {
        queryClient.removeQueries({ queryKey: queryKeys.me });
        router.replace('/sign-in');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [queryClient, router]);

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel="Loading SmartResidence"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color="#FF5A5F" accessibilityLabel="Loading" />
    </View>
  );
}
