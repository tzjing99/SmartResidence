'use client';

import type { LocalePreference } from '@/i18n/detect-locale';
import { useLocale, useT } from '@/i18n/locale-provider';
import { api, writeSession } from '@/lib/api';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import { MalaysiaPhoneSchema } from '@smartresidence/shared-types';
import { Button, Card, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Download,
  Globe,
  MessageCircle,
  Moon,
  Save,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const LOCALE_OPTIONS: LocalePreference[] = ['system', 'en', 'ms', 'zh-Hans'];
const DELETE_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: MalaysiaPhoneSchema,
});

export default function ProfileSettingsPage() {
  const t = useT();
  const { preference: localePreference, setPreference: setLocalePreference } = useLocale();
  const qc = useQueryClient();
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);

  const localeLabels: Record<LocalePreference, string> = {
    system: t('account.localeSystem'),
    en: t('account.localeEn'),
    ms: t('account.localeMs'),
    'zh-Hans': t('account.localeZhHans'),
  };

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
  const [whatsappNotifications, setWhatsappNotifications] = React.useState(false);
  const [quietEnabled, setQuietEnabled] = React.useState(false);
  const [quietStart, setQuietStart] = React.useState('22:00');
  const [quietEnd, setQuietEnd] = React.useState('07:00');
  const [exportPending, setExportPending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);

  async function onDownloadMyData() {
    setExportPending(true);
    try {
      const meta = await api.requestDataExport();
      const blob = await api.downloadDataExport(meta.exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartresidence-data-export-${meta.exportId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('account.downloadMyDataSuccess'));
    } catch (err) {
      toast.error((err as Error).message || t('account.downloadMyDataError'));
    } finally {
      setExportPending(false);
    }
  }

  async function onDeleteAccount() {
    if (!window.confirm(t('account.deleteAccountDesc'))) return;
    const typed = window.prompt(t('account.deleteAccountConfirmPrompt'), '');
    if (typed === null) {
      return;
    }
    if (typed.trim() !== DELETE_CONFIRM_PHRASE) {
      toast.error(t('account.deleteAccountError'));
      return;
    }
    setDeletePending(true);
    try {
      await api.deleteAccount(DELETE_CONFIRM_PHRASE);
      writeSession(null);
      qc.clear();
      toast.success(t('account.deleteAccountSuccess'));
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
    } catch (err) {
      toast.error((err as Error).message || t('account.deleteAccountError'));
    } finally {
      setDeletePending(false);
    }
  }

  React.useEffect(() => {
    if (!prefs.data) return;
    setEmailNotifications(prefs.data.emailNotifications);
    setWhatsappNotifications(prefs.data.whatsappNotifications);
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
        whatsappNotifications,
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
    <div className="max-w-lg flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title flex items-center gap-2">
            <User className="size-5 text-coral-500" aria-hidden />
            Profile
          </h2>
          <p className="sr-muted text-sm mt-1">
            Your phone number lets guards reach you when a walk-in visitor is waiting for approval.
          </p>
        </header>

        <Card className="!p-5">
          <form className="flex flex-col gap-3" onSubmit={profileForm.handleSubmit(onSaveProfile)}>
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
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title flex items-center gap-2">
            <Globe className="size-5 text-coral-500" aria-hidden />
            {t('account.languageTitle')}
          </h2>
          <p className="sr-muted text-sm mt-1">{t('account.languageDesc')}</p>
        </header>

        <Card className="!p-5">
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">{t('account.languageTitle')}</legend>
            <div className="flex flex-wrap gap-2">
              {LOCALE_OPTIONS.map((value) => {
                const active = localePreference === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLocalePreference(value)}
                    className={
                      active
                        ? 'rounded-xl border border-coral-500 bg-coral-50 px-3 py-2 text-sm font-semibold text-coral-600 dark:bg-coral-950/40'
                        : 'rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 py-2 text-sm font-semibold text-[rgb(var(--sr-fg))]'
                    }
                  >
                    {localeLabels[value]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title flex items-center gap-2">
            <Bell className="size-5 text-coral-500" aria-hidden />
            Notifications
          </h2>
          <p className="sr-muted text-sm mt-1">
            In-app alerts are always on. Choose optional email, WhatsApp, and quiet hours below.
          </p>
        </header>

        <Card className="!p-5 flex flex-col gap-5">
          <div>
            <Label className="font-medium">Email for helpdesk updates</Label>
            <p className="text-xs sr-muted mt-1">
              Optional — get thread replies by email when you&apos;re away from the app.
            </p>
            <label className="flex items-start gap-2 mt-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              Send thread notifications to my email
            </label>
          </div>

          <div className="border-t border-[rgb(var(--sr-border))] pt-5">
            <Label className="font-medium flex items-center gap-2">
              <MessageCircle className="size-4 sr-muted" aria-hidden />
              WhatsApp alerts
            </Label>
            <p className="text-xs sr-muted mt-1">
              Parcel, visitor, and billing reminders on your verified mobile number. Your building
              must have WhatsApp enabled first.
            </p>
            {prefs.data?.whatsappEligible ? (
              <label className="flex items-start gap-2 mt-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappNotifications}
                  onChange={(e) => setWhatsappNotifications(e.target.checked)}
                  className="mt-0.5 shrink-0"
                />
                Send alerts to {profile.data?.phone ?? 'my verified phone'} on WhatsApp
              </label>
            ) : (
              <p className="text-xs sr-muted mt-3 rounded-lg bg-[rgb(var(--sr-bg))] px-3 py-2">
                Add and verify your mobile phone in Profile above before opting in to WhatsApp.
              </p>
            )}
          </div>

          <div className="border-t border-[rgb(var(--sr-border))] pt-5">
            <Label className="font-medium flex items-center gap-2">
              <Moon className="size-4 sr-muted" aria-hidden />
              Quiet hours
            </Label>
            <p className="text-xs sr-muted mt-1">
              Pause mobile push during these hours. In-app notifications still arrive.
            </p>
            <label className="flex items-start gap-2 mt-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="mt-0.5 shrink-0"
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
                    className="sr-select-sm mt-1 block"
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
                    className="sr-select-sm mt-1 block"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <Button
            onClick={() => void onSavePrefs()}
            disabled={save.isPending}
            className="self-start"
          >
            <Save className="size-4" />
            Save notification preferences
          </Button>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="sr-section-title flex items-center gap-2">
            <Shield className="size-5 text-coral-500" aria-hidden />
            {t('account.privacyTitle')}
          </h2>
          <p className="sr-muted text-sm mt-1">{t('account.privacyDesc')}</p>
        </header>

        <Card className="!p-5 flex flex-col gap-4">
          <Button
            onClick={() => void onDownloadMyData()}
            disabled={exportPending || deletePending}
            className="self-start"
          >
            <Download className="size-4" />
            {exportPending ? t('account.downloadMyDataPending') : t('account.downloadMyData')}
          </Button>

          <div className="border-t border-border/60 pt-4 flex flex-col gap-2">
            <p className="text-sm sr-muted">{t('account.deleteAccountDesc')}</p>
            <Button
              variant="destructive"
              onClick={() => void onDeleteAccount()}
              disabled={deletePending || exportPending}
              className="self-start"
            >
              <Trash2 className="size-4" />
              {deletePending ? t('account.deleteAccountPending') : t('account.deleteAccount')}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
