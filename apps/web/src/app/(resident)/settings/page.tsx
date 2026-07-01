'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import { MalaysiaPhoneSchema } from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Moon, Save, User } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: MalaysiaPhoneSchema,
});

/** E1 email opt-in + E5 quiet hours + profile phone for residents. */
export default function ProfileSettingsPage() {
  const qc = useQueryClient();
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);

  const profile = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: () => api.getProfile(),
  });

  const saveProfile = useMutation({
    mutationFn: (input: { name: string; email: string; phone: string }) => api.updateProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'profile'] });
      toast.success('Profile saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

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

  React.useEffect(() => {
    if (!profile.data) return;
    profileForm.reset({
      name: profile.data.name,
      email: profile.data.email ?? '',
      phone: profile.data.phone ?? '',
    });
  }, [profile.data, profileForm]);

  async function onSavePrefs() {
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

  async function onSaveProfile(values: z.infer<typeof profileSchema>) {
    await saveProfile.mutateAsync(values);
  }

  if (prefs.isLoading || profile.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h2 className="sr-section-title">Profile</h2>
        <p className="sr-muted text-sm mt-1">
          Your phone number lets guards reach you when a walk-in visitor is waiting for approval.
        </p>
      </div>

      <Card className="p-5 flex flex-col gap-4">
        <div className="align-row items-start min-h-0">
          <User className="size-5 shrink-0 mt-0.5" />
          <form
            className="flex-1 flex flex-col gap-3"
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
          >
            <div>
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" className="mt-1" {...profileForm.register('name')} />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                className="mt-1"
                type="email"
                {...profileForm.register('email')}
              />
              {profileForm.formState.errors.email ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {profileForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="profile-phone">Mobile phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                className="mt-1"
                placeholder="+60123456789"
                {...profileForm.register('phone')}
              />
              {profileForm.formState.errors.phone ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {profileForm.formState.errors.phone.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={saveProfile.isPending} className="self-start">
              <Save className="size-4" />
              Save profile
            </Button>
          </form>
        </div>
      </Card>

      <div>
        <h2 className="sr-section-title">Notifications</h2>
        <p className="sr-muted text-sm mt-1">
          In-app and mobile push notifications are always on for thread updates. Configure optional
          email and quiet hours below.
        </p>
      </div>

      <Card className="p-5 flex flex-col gap-4">
        <div className="align-row items-start min-h-0">
          <Bell className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="font-medium">Email for thread updates (E1)</Label>
            <p className="text-xs sr-muted mt-1">
              Opt in to receive helpdesk thread notifications by email. Off by default.
            </p>
            <label className="align-row mt-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="shrink-0"
              />
              Send thread notifications to my email
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5 flex flex-col gap-4">
        <div className="align-row items-start min-h-0">
          <Moon className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="font-medium">Quiet hours (E5)</Label>
            <p className="text-xs sr-muted mt-1">
              Suppress mobile push during these hours. In-app notifications still arrive.
            </p>
            <label className="align-row mt-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="shrink-0"
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
                    className="sr-select-sm mt-1"
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
                    className="sr-select-sm mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Button onClick={onSavePrefs} disabled={save.isPending}>
        <Save className="size-4" />
        Save notification preferences
      </Button>
    </div>
  );
}
