'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button, Card, Input, Label } from '@smartresidence/ui-web';
import { api, writeSession } from '@/lib/api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Required'),
  totp: z.string().optional(),
});

export default function SignInPage() {
  const router = useRouter();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const [needsTotp, setNeedsTotp] = React.useState(false);

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
      toast.success('Signed in');
      router.push('/dashboard');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('2fa')) {
        setNeedsTotp(true);
        toast.message('Enter your 2FA code to continue');
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
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm sr-muted mt-1">
            Sign in to manage visitors, fees, and defects for your unit.
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          </div>
          {needsTotp ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp">2FA code</Label>
              <Input id="totp" inputMode="numeric" maxLength={6} {...form.register('totp')} />
            </div>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-sm sr-muted">
          New here?{' '}
          <Link href="/sign-up" className="text-coral-500 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-xs sr-muted">
          Demo: <code>owner@acacia.demo</code> / <code>Demo!2026</code>
        </p>
      </Card>
    </div>
  );
}
