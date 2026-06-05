import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { api } from '../src/lib/api';
import { getCachedSession } from '../src/lib/session';

export default function Bootstrap() {
  const router = useRouter();

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
        const role = (me as { user?: { activeRole?: string } }).user?.activeRole;
        if (role === 'SECURITY_GUARD') router.replace('/(guard)/scan');
        else if (role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF') {
          router.replace('/(management)/helpdesk-settings' as Href);
        } else router.replace('/(resident)/home');
      } catch {
        router.replace('/sign-in');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#FF5A5F" />
    </View>
  );
}
