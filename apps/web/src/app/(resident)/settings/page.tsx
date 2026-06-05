'use client';

import { api } from '@/lib/api';
import { usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import { Button, Card, Label, Skeleton } from '@smartresidence/ui-web';
import { Bell, Moon, Save } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

/** E1 email opt-in + E5 quiet hours for residents. */
export default function ProfileSettingsPage() {
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);

  const [emailNotifications, setEmailNotifications] = React.useState(false);
  const [quietEnabled, setQuietEnabled] = React.useState(false);
  const [quietStart, setQuietStart] = React.useState('22:00');
  const [quietEnd, setQuietEnd] = React.useState('07:00');

  React.useEffect(() => {
    if (!prefs.data) return;
    setEmailNotifications(prefs.data.emailNotifications);
    setQuietEnabled(prefs.data.quietHours.enabled);
    setQuietStart(prefs.data.quietHours.start);
    setQuietEnd(prefs.data.quietHours.end);
  }, [prefs.data]);

  async function onSave() {
    try {
      await save.mutateAsync({
        emailNotifications,
        quietHours: { enabled: quietEnabled, start: quietStart, end: quietEnd },
      });
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (prefs.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h2 className="sr-section-title">Notification settings</h2>
        <p className="sr-muted text-sm mt-1">
          In-app and mobile push notifications are always on for thread updates. Configure optional
          email and quiet hours below.
        </p>
      </div>

      <Card className="p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Bell className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="font-medium">Email for thread updates (E1)</Label>
            <p className="text-xs sr-muted mt-1">
              Opt in to receive helpdesk thread notifications by email. Off by default.
            </p>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
              />
              Send thread notifications to my email
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Moon className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="font-medium">Quiet hours (E5)</Label>
            <p className="text-xs sr-muted mt-1">
              Suppress mobile push during these hours. In-app notifications still arrive.
            </p>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
              />
              Enable quiet hours
            </label>
            {quietEnabled ? (
              <div className="flex flex-wrap gap-3 mt-3">
                <div>
                  <Label htmlFor="quiet-start" className="text-xs sr-muted">
                    From
                  </Label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="block h-10 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end" className="text-xs sr-muted">
                    Until
                  </Label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="block h-10 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Button onClick={onSave} disabled={save.isPending}>
        <Save className="size-4" />
        Save preferences
      </Button>
    </div>
  );
}
