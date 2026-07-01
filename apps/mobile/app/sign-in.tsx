import { queryKeys } from '@smartresidence/api-client';
import {
  AppText,
  Button,
  Card,
  FadeInView,
  Field,
  Input,
  palette,
} from '@smartresidence/ui-mobile';
import { useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api } from '../src/lib/api';
import { hapticError } from '../src/lib/haptics';
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
      hapticError();
      Alert.alert('Sign in failed', (err as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <FadeInView>
          <AppText style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}>
            Smart
            <AppText style={{ color: palette.coralPrimary, fontSize: 32, fontWeight: '700' }}>
              Residence
            </AppText>
          </AppText>
          <AppText style={{ color: palette.mutedLight, marginBottom: 24 }}>
            Welcome back. Sign in to continue.
          </AppText>
          <Card>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                returnKeyType="next"
              />
            </Field>
            <View style={{ marginTop: 14 }}>
              <Field label="Password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={signIn}
                />
              </Field>
            </View>
            <View style={{ marginTop: 20 }}>
              <Button
                title={loading ? 'Signing in…' : 'Sign in'}
                loading={loading}
                onPress={signIn}
              />
            </View>
          </Card>
          <AppText
            style={{ marginTop: 24, color: palette.mutedLight, fontSize: 12, textAlign: 'center' }}
          >
            Demo accounts · password Demo!2026{'\n'}
            Resident owner@acacia.demo · Gate guard@acacia.demo
          </AppText>
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
