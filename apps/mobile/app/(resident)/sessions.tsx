import { type AuthSession, useRevokeSession, useSessions } from '@smartresidence/api-client';
import { AppText, Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { readSession, setCached, writeSession } from '../../src/lib/session';

function sessionDeviceLabel(session: AuthSession): string {
  const fromDevice =
    session.deviceInfo && typeof session.deviceInfo === 'object'
      ? session.deviceInfo.device
      : undefined;
  if (fromDevice) return fromDevice;
  const ua = session.userAgent;
  if (!ua) return 'Unknown device';
  if (/iPhone|iPad/i.test(ua)) return 'Apple mobile';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web browser';
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function SessionsScreen() {
  const qc = useQueryClient();
  const sessions = useSessions(api);
  const revoke = useRevokeSession(api);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => sessions.refetch().then(() => undefined), [sessions]),
  );

  useEffect(() => {
    void readSession().then((s) => setCurrentSessionId(s?.sessionId ?? null));
  }, []);

  function confirmRevoke(session: AuthSession) {
    const isCurrent = session.id === currentSessionId;
    Alert.alert(
      'Revoke this session?',
      isCurrent
        ? 'You will be signed out of this device immediately.'
        : 'This device will be signed out immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            void revoke
              .mutateAsync(session.id)
              .then(async () => {
                if (isCurrent) {
                  await writeSession(null);
                  setCached(null);
                  qc.clear();
                  router.replace('/sign-in' as Href);
                  return;
                }
                Alert.alert('Session revoked');
              })
              .catch((err) => Alert.alert('Could not revoke session', (err as Error).message));
          },
        },
      ],
    );
  }

  const items = sessions.data ?? [];

  return (
    <ResidentScreen
      eyebrow="Security"
      title="Devices & sessions"
      subtitle="Review where you're signed in and revoke access you don't recognize."
      scrollProps={{ refreshControl }}
    >
      <ResidentSectionHeader title="Active sessions" />

      {sessions.isLoading ? (
        <Card style={residentStyles.card}>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            Loading…
          </AppText>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState title="No active sessions" description="You are not signed in anywhere else." />
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((session) => {
            const isCurrent = session.id === currentSessionId;
            return (
              <Card key={session.id} style={[residentStyles.card, { gap: 8 }]}>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                >
                  <AppText style={{ fontWeight: '700', color: palette.textLight, flex: 1 }}>
                    {sessionDeviceLabel(session)}
                  </AppText>
                  {isCurrent ? <Pill label="This device" tone="primary" /> : null}
                </View>
                {session.ipAddress ? (
                  <AppText variant="meta" style={{ color: palette.mutedLight }}>
                    IP {session.ipAddress}
                  </AppText>
                ) : null}
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  Signed in {formatWhen(session.createdAt)}
                </AppText>
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  Last active {formatWhen(session.lastUsedAt ?? session.createdAt)}
                </AppText>
                <Button
                  title="Revoke"
                  variant="secondary"
                  loading={revoke.isPending}
                  onPress={() => confirmRevoke(session)}
                />
              </Card>
            );
          })}
        </View>
      )}
    </ResidentScreen>
  );
}
