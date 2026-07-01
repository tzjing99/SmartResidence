import { queryKeys } from '@smartresidence/api-client';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { api } from '../src/lib/api';
import { getActiveRole, roleToHomePath } from '../src/lib/roles';
import { setCached, writeSession } from '../src/lib/session';

export default function SignInScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signingInRef = useRef(false);
  const [email, setEmail] = useState('owner@acacia.demo');
  const [password, setPassword] = useState('Demo!2026');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setLoading(true);

    try {
      const res = await api.signIn({ email, password });
      const session = {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        sessionId: res.sessionId,
        expiresAt: Date.now() + res.expiresIn * 1000,
        activeCondoId: null,
      };
      await writeSession(session);
      setCached(session);
      // Push registration is handled by PushNavigationBridge, which reacts to
      // this session change via subscribeSession.

      let home: Href = '/(resident)/home';
      try {
        const me = await api.me();
        queryClient.setQueryData(queryKeys.me, me);
        home = roleToHomePath(getActiveRole(me));
      } catch {
        queryClient.removeQueries({ queryKey: queryKeys.me });
      }

      router.replace(home);

      void LocalAuthentication.hasHardwareAsync().then((supported) => {
        if (!supported) return;
        void LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm to enable Face ID for SmartResidence',
        }).catch(() => undefined);
      });
    } catch (err) {
      signingInRef.current = false;
      setLoading(false);
      Alert.alert('Sign in failed', (err as Error).message);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: palette.bgLight,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
        Smart<Text style={{ color: palette.coralPrimary }}>Residence</Text>
      </Text>
      <Text style={{ color: palette.mutedLight, marginBottom: 24 }}>
        Welcome back. Sign in to continue.
      </Text>
      <Card>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          style={{
            height: 48,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.borderLight,
            paddingHorizontal: 14,
            fontSize: 15,
          }}
        />
        <Text style={{ fontWeight: '600', marginTop: 14, marginBottom: 6 }}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          style={{
            height: 48,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.borderLight,
            paddingHorizontal: 14,
            fontSize: 15,
          }}
        />
        <View style={{ marginTop: 20 }}>
          <Button title={loading ? 'Signing in…' : 'Sign in'} loading={loading} onPress={signIn} />
        </View>
      </Card>
      <Text style={{ marginTop: 24, color: palette.mutedLight, fontSize: 12, textAlign: 'center' }}>
        Demo accounts · password Demo!2026{'\n'}
        Resident owner@acacia.demo · Gate guard@acacia.demo
      </Text>
    </View>
  );
}
