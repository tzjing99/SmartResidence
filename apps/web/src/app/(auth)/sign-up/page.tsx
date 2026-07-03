'use client';

import { api, writeSession } from '@/lib/api';
import { useT } from '@/i18n/locale-provider';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { MalaysiaPhoneSchema } from '@smartresidence/shared-types';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export default function SignUpPage() {
  const t = useT();
  const router = useRouter();
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: MalaysiaPhoneSchema,
    password: z
      .string()
      .min(10, t('auth.passwordMinLength'))
      .regex(/[A-Z]/, t('auth.passwordUppercase'))
      .regex(/[a-z]/, t('auth.passwordLowercase'))
      .regex(/\d/, t('auth.passwordDigit')),
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const res = await api.signUp(values);
      writeSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        sessionId: res.sessionId,
        expiresAt: Date.now() + 60 * 15 * 1000,
        activeCondoId: null,
      });
      toast.success(t('auth.welcomeToast'));
      router.push('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Smart<span className="text-coral-500">Residence</span>
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('auth.createAccountTitle')}</h1>
          <p className="text-sm sr-muted mt-1">
            {t('auth.signUpBlurb')}
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t('auth.fullName')}</Label>
            <Input id="name" {...form.register('name')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t('auth.mobilePhone')}</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+60123456789"
              {...form.register('phone')}
            />
            {form.formState.errors.phone ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.phone.message}
              </p>
            ) : (
              <p className="text-xs sr-muted">
                {t('auth.phoneHint')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.password.message}
              </p>
            ) : (
              <p className="text-xs sr-muted">{t('auth.passwordHint')}</p>
            )}
          </div>
          <Button type="submit" loading={form.formState.isSubmitting} className="mt-2">
            {t('auth.signUp')}
          </Button>
        </form>
        <p className="mt-6 text-sm sr-muted">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link href="/sign-in" className="text-coral-500 hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
