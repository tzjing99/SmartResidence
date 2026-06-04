import { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { api } from '../src/lib/api';
import { setCached, writeSession } from '../src/lib/session';
import { registerForPush } from '../src/lib/push';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@acacia.demo');
  const [password, setPassword] = useState('Demo!2026');
  const [loading, setLoading] = useState(false);

  async function signIn() {
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
      void registerForPush();

      const supported = await LocalAuthentication.hasHardwareAsync();
      if (supported) {
        // Best-effort biometric prompt to lock subsequent app opens
        await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm to enable Face ID for SmartResidence',
        }).catch(() => undefined);
      }

      router.replace('/(resident)/home');
    } catch (err) {
      Alert.alert('Sign in failed', (err as Error).message);
    } finally {
      setLoading(false);
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
        Demo: owner@acacia.demo · Demo!2026
      </Text>
    </View>
  );
}
