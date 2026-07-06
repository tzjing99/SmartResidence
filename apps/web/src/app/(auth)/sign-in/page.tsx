'use client';

import { useT } from '@/i18n/locale-provider';
import { api, writeSession } from '@/lib/api';
import { type MeResponse, roleToHome } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryKeys } from '@smartresidence/api-client';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/** Strip sensitive query params; prefill email from `?email=` only (never password). */
function useSignInQueryParams(
  form: ReturnType<typeof useForm<{ email: string; password: string; totp?: string }>>,
) {
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email) form.setValue('email', email);

    if (!params.has('password')) return;

    params.delete('password');
    const qs = params.toString();
    const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', clean);
  }, [form]);
}

export default function SignInPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const schema = React.useMemo(
    () =>
      z.object({
        email: z.string().email(),
        password: z.string().min(1, t('auth.required')),
        totp: z.string().optional(),
      }),
    [t],
  );
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const [needsTotp, setNeedsTotp] = React.useState(false);
  const passwordErrorId = React.useId();
  useSignInQueryParams(form);

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const res = await api.signIn(values);
      writeSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        sessionId: res.sessionId,
        expiresAt: Date.now() + res.expiresIn * 1000,
        activeCondoId: null,
      });
      queryClient.removeQueries({ queryKey: queryKeys.me });
      queryClient.removeQueries({ queryKey: queryKeys.myCondos });
      toast.success(t('auth.signedInToast'));
      // Route the user to the home that matches their role (management → /admin,
      // guard → /guard, residents → /dashboard) instead of assuming resident.
      let home = '/dashboard';
      try {
        const me = (await api.me()) as MeResponse;
        home = roleToHome(me.user?.activeRole ?? null);
      } catch {
        /* fall back to resident home */
      }
      router.push(home);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('2fa')) {
        setNeedsTotp(true);
        toast.message(t('auth.totpPrompt'));
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Smart<span className="text-coral-500">Residence</span>
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('auth.welcomeBack')}</h1>
          <p className="text-sm sr-muted mt-1">{t('auth.signInBlurb')}</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={form.formState.errors.password ? true : undefined}
              aria-describedby={form.formState.errors.password ? passwordErrorId : undefined}
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p id={passwordErrorId} className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          {needsTotp ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp">{t('auth.totp')}</Label>
              <Input id="totp" inputMode="numeric" maxLength={6} {...form.register('totp')} />
            </div>
          ) : null}
          <Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            {t('auth.signIn')}
          </Button>
        </form>
        <p className="mt-6 text-sm sr-muted">
          {t('auth.newHere')}{' '}
          <Link href="/sign-up" className="text-coral-500 hover:underline">
            {t('auth.signUp')}
          </Link>
        </p>
        {process.env.NODE_ENV !== 'production' ? (
          <p className="mt-2 text-xs sr-muted">
            {t('auth.demoHint', { email: 'owner@acacia.demo', password: 'Demo!2026' })}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
