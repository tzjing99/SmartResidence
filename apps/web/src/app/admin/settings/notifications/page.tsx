'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useMyCondos,
  useTestWhatsAppSend,
  useUpdateWhatsAppConfig,
  useWhatsAppConfig,
} from '@smartresidence/api-client';
import { DEFAULT_WHATSAPP_CONFIG, type WhatsAppConfig } from '@smartresidence/shared-types';
import { Badge, Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Bell, KeyRound, MessageCircle, Send } from 'lucide-react';
import * as React from 'react';

function SettingsSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-start gap-4 border-b border-[rgb(var(--sr-border))]/70 p-5 sm:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]">
          <Icon className="size-5 text-[rgb(var(--sr-coral))]" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-wide sr-muted font-semibold">{eyebrow}</div>
          <h3 className="text-lg font-semibold mt-1">{title}</h3>
          <p className="text-sm sr-muted mt-1 max-w-3xl">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  );
}

function WhatsAppForm({ condoId }: { condoId: string }) {
  const config = useWhatsAppConfig(api, condoId);
  const update = useUpdateWhatsAppConfig(api);
  const testSend = useTestWhatsAppSend(api);
  const [draft, setDraft] = React.useState<WhatsAppConfig>(DEFAULT_WHATSAPP_CONFIG);
  const [apiKey, setApiKey] = React.useState('');
  const [testPhone, setTestPhone] = React.useState('');
  const apiKeyConfigured = config.data?.apiKeyConfigured ?? false;

  React.useEffect(() => {
    if (config.data) {
      const { apiKeyConfigured: _k, updatedAt: _u, ...rest } = config.data;
      setDraft(rest);
    }
  }, [config.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        condoId,
        input: {
          ...draft,
          apiKey: apiKey.trim() || undefined,
        },
      });
      setApiKey('');
      toast.success('WhatsApp settings saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.error('Enter a phone number for the test message');
      return;
    }
    try {
      const result = await testSend.mutateAsync({ condoId, phone: testPhone.trim() });
      if (result.ok) {
        toast.success(
          result.mode === 'mock' ? 'Test logged (no credentials configured)' : 'Test message sent',
        );
      } else {
        toast.error(result.detail);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (config.isLoading) return <Skeleton className="h-80" />;

  return (
    <form className="flex flex-col gap-6" onSubmit={save}>
      <SettingsSection
        icon={MessageCircle}
        eyebrow="WhatsApp"
        title="Resident WhatsApp alerts"
        description="Send parcel, visitor, and billing reminders through Meta WhatsApp Cloud API. Residents must opt in and have a verified phone on their profile."
      >
        <div className="flex flex-col gap-4">
          <label className="inline-flex items-start gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 bg-[rgb(var(--sr-card))] p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="mt-0.5 size-4 rounded border-[rgb(var(--sr-border))]"
            />
            <span>
              <span className="block font-medium">Enable WhatsApp notifications</span>
              <span className="block text-xs sr-muted">
                When off, no WhatsApp messages are sent regardless of resident preferences.
              </span>
            </span>
          </label>
          {draft.enabled ? (
            <Badge tone="success" className="self-start">
              Channel active for opted-in residents
            </Badge>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={KeyRound}
        eyebrow="Meta Cloud API"
        title="Connection details"
        description="Create a permanent access token and phone number ID in Meta Business Manager. The token is encrypted at rest and never shown again after saving."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="wa-phone-id">Phone number ID</Label>
            <Input
              id="wa-phone-id"
              className="mt-1"
              placeholder="123456789012345"
              value={draft.phoneNumberId}
              onChange={(e) => setDraft({ ...draft, phoneNumberId: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="wa-business-id">WhatsApp Business account ID</Label>
            <Input
              id="wa-business-id"
              className="mt-1"
              placeholder="123456789012345"
              value={draft.businessAccountId}
              onChange={(e) => setDraft({ ...draft, businessAccountId: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="wa-api-key">
              API access token {apiKeyConfigured ? '(configured — leave blank to keep)' : ''}
            </Label>
            <Input
              id="wa-api-key"
              type="password"
              className="mt-1"
              placeholder={apiKeyConfigured ? '••••••••' : 'EAAxxxxxxxx…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs sr-muted mt-1">
              Without credentials, messages are logged only (sandbox mode) — useful for local
              development.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={update.isPending}>
            Save WhatsApp settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Send}
        eyebrow="Test"
        title="Send a test message"
        description="Sends the parcel-received template to a phone number. Use your own mobile to confirm delivery."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="wa-test-phone">Test phone number</Label>
            <Input
              id="wa-test-phone"
              type="tel"
              className="mt-1"
              placeholder="+60123456789"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={testSend.isPending}
            onClick={sendTest}
          >
            Send test
          </Button>
        </div>
        <p className="text-xs sr-muted mt-3">
          Approved templates required in Meta: <code>sr_parcel_received</code>,{' '}
          <code>sr_visitor_arrived</code>, <code>sr_invoice_due</code>.
        </p>
      </SettingsSection>
    </form>
  );
}

/** Admin notification channel settings — WhatsApp v1.0. */
export default function AdminNotificationsSettingsPage() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h2 className="sr-section-title flex items-center gap-2">
          <Bell className="size-5" /> Notification channels
        </h2>
        <p className="sr-muted text-sm mt-1">
          Configure optional delivery channels for resident alerts. In-app and mobile push remain on
          by default.
        </p>
      </div>

      {condos.isLoading ? (
        <Skeleton className="h-80" />
      ) : condoId ? (
        <WhatsAppForm condoId={condoId} />
      ) : (
        <Card className="p-5">
          <p className="text-sm sr-muted">Select a condo to configure WhatsApp notifications.</p>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm sr-muted">
          Staff helpdesk notification preferences are not configurable yet. Assigned threads still
          appear in-app.
        </p>
      </Card>
    </div>
  );
}
