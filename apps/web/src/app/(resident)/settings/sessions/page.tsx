'use client';

import { useT } from '@/i18n/locale-provider';
import { api, readSession, writeSession } from '@/lib/api';
import { toast } from '@/lib/toast';
import { type AuthSession, useRevokeSession, useSessions } from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { MonitorSmartphone } from 'lucide-react';
import * as React from 'react';

function sessionDeviceLabel(session: AuthSession, unknownLabel: string): string {
  const fromDevice =
    session.deviceInfo && typeof session.deviceInfo === 'object'
      ? session.deviceInfo.device
      : undefined;
  if (fromDevice) return fromDevice;
  const ua = session.userAgent;
  if (!ua) return unknownLabel;
  if (/iPhone|iPad/i.test(ua)) return 'Apple mobile';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web browser';
}

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale);
}

export default function SessionsSettingsPage() {
  const t = useT();
  const sessions = useSessions(api);
  const revoke = useRevokeSession(api);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en';

  React.useEffect(() => {
    setCurrentSessionId(readSession()?.sessionId ?? null);
  }, []);

  async function onRevoke(session: AuthSession) {
    const isCurrent = session.id === currentSessionId;
    const confirmed = window.confirm(
      isCurrent ? t('sessions.revokeCurrentConfirmBody') : t('sessions.revokeConfirmBody'),
    );
    if (!confirmed) return;

    try {
      await revoke.mutateAsync(session.id);
      if (isCurrent) {
        writeSession(null);
        window.location.href = '/sign-in';
        return;
      }
      toast.success(t('sessions.revokeSuccess'));
    } catch (err) {
      toast.error((err as Error).message || t('sessions.revokeError'));
    }
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title flex items-center gap-2">
          <MonitorSmartphone className="size-5 text-coral-500" aria-hidden />
          {t('sessions.title')}
        </h2>
        <p className="sr-muted text-sm mt-1">{t('sessions.subtitle')}</p>
      </header>

      <Card className="!p-5">
        {sessions.isLoading ? (
          <Skeleton className="h-24" />
        ) : sessions.data?.length ? (
          <ul className="flex flex-col gap-4">
            {sessions.data.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 border-b border-[rgb(var(--sr-border))]/40 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">
                          {sessionDeviceLabel(session, t('sessions.unknownDevice'))}
                        </span>
                        {isCurrent ? (
                          <Badge tone="primary">{t('sessions.currentSession')}</Badge>
                        ) : null}
                      </div>
                      {session.ipAddress ? (
                        <p className="text-xs sr-muted mt-1">
                          {t('sessions.ipAddress', { address: session.ipAddress })}
                        </p>
                      ) : null}
                      <p className="text-xs sr-muted mt-1">
                        {t('sessions.signedIn', { time: formatWhen(session.createdAt, locale) })}
                      </p>
                      <p className="text-xs sr-muted">
                        {t('sessions.lastActive', {
                          time: formatWhen(session.lastUsedAt ?? session.createdAt, locale),
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => void onRevoke(session)}
                      className="shrink-0"
                    >
                      {t('sessions.revoke')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm sr-muted">{t('sessions.empty')}</p>
        )}
      </Card>
    </div>
  );
}
