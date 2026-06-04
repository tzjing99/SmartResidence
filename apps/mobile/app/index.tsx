import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedSession } from '../src/lib/session';
import { api } from '../src/lib/api';

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
        const isGuard = (me as any).user?.activeRole === 'SECURITY_GUARD';
        router.replace(isGuard ? '/(guard)/scan' : '/(resident)/home');
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
