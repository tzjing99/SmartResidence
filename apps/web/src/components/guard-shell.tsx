'use client';

import { PageFade } from '@/components/shell-nav';
import { api } from '@/lib/api';
import { useSignOut } from '@/lib/use-sign-out';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useMyCondos } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import { LogOut, Settings2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Minimal shell for SECURITY_GUARD on the web. Guards only need the visitor
 * verification / log surface — they get no resident or management navigation.
 * The full guard UX (QR scanning, check-in/out) lives in the mobile app.
 */
export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useRoleGuard('guard');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const signOut = useSignOut();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center sr-muted text-sm">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--sr-bg))]">
      <header className="sticky top-0 z-20 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Link href="/guard" className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="size-5 shrink-0 text-coral-500" aria-hidden />
          <div className="min-w-0 leading-tight">
            <div className="text-xl font-bold tracking-tight truncate">
              Smart<span className="text-coral-500">Residence</span>
              <span className="text-sm font-semibold sr-muted ml-1.5">Gate</span>
            </div>
            {condo ? <div className="text-xs sr-muted truncate">{condo.name}</div> : null}
          </div>
        </Link>
        <nav
          aria-label="Gate navigation"
          className="flex items-center gap-0.5 shrink-0 flex-nowrap"
        >
          <Link
            href="/guard"
            aria-current={pathname === '/guard' ? 'page' : undefined}
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              pathname === '/guard'
                ? 'text-coral-500 bg-coral-500/10'
                : 'hover:bg-[rgb(var(--sr-border))]/40',
            )}
          >
            Live
          </Link>
          <Link
            href="/guard/expected"
            aria-current={pathname.startsWith('/guard/expected') ? 'page' : undefined}
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              pathname.startsWith('/guard/expected')
                ? 'text-coral-500 bg-coral-500/10'
                : 'hover:bg-[rgb(var(--sr-border))]/40',
            )}
          >
            Expected
          </Link>
          <Link
            href="/guard/check-in"
            aria-current={pathname.startsWith('/guard/check-in') ? 'page' : undefined}
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              pathname.startsWith('/guard/check-in')
                ? 'text-coral-500 bg-coral-500/10'
                : 'hover:bg-[rgb(var(--sr-border))]/40',
            )}
          >
            Check-in
          </Link>
          <Link
            href="/guard/walk-in"
            aria-current={pathname.startsWith('/guard/walk-in') ? 'page' : undefined}
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              pathname.startsWith('/guard/walk-in')
                ? 'text-coral-500 bg-coral-500/10'
                : 'hover:bg-[rgb(var(--sr-border))]/40',
            )}
          >
            Walk-in
          </Link>
          <Link
            href="/guard/settings"
            aria-current={pathname.startsWith('/guard/settings') ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              pathname.startsWith('/guard/settings')
                ? 'text-coral-500 bg-coral-500/10'
                : 'hover:bg-[rgb(var(--sr-border))]/40',
            )}
          >
            <Settings2 className="size-4" />
            Settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[rgb(var(--sr-border))]/40 text-sm"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </nav>
      </header>
      <main className="flex-1 min-w-0 p-6 md:p-10 max-w-5xl w-full mx-auto">
        <PageFade>{children}</PageFade>
      </main>
    </div>
  );
}
