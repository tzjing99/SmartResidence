'use client';

import { api, writeSession } from '@/lib/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useMyCondos } from '@smartresidence/api-client';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * Minimal shell for SECURITY_GUARD on the web. Guards only need the visitor
 * verification / log surface — they get no resident or management navigation.
 * The full guard UX (QR scanning, check-in/out) lives in the mobile app.
 */
export function GuardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready } = useRoleGuard('guard');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  async function signOut() {
    try {
      await api.signOut();
    } catch {
      /* ignore */
    }
    writeSession(null);
    router.push('/sign-in');
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center sr-muted text-sm">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--sr-bg))]">
      <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-coral-500" />
          <span className="text-base font-semibold tracking-tight">
            Smart<span className="text-coral-500">Residence</span> · Gate
          </span>
          {condo ? <span className="text-xs sr-muted ml-2 truncate">{condo.name}</span> : null}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[rgb(var(--sr-border))]/40 text-sm"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </header>
      <main className="flex-1 min-w-0 p-6 md:p-10 max-w-4xl w-full mx-auto">{children}</main>
    </div>
  );
}
