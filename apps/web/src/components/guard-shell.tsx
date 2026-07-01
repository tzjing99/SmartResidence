'use client';

import { MobileTabBar } from '@/components/mobile-tab-bar';
import { PageFade, prefetchRoute } from '@/components/shell-nav';
import { api } from '@/lib/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useSignOut } from '@/lib/use-sign-out';
import { useMyCondos } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import { LogOut, Settings2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

const GUARD_NAV = [
  { href: '/guard', label: 'Live', match: (p: string) => p === '/guard' },
  {
    href: '/guard/expected',
    label: 'Expected',
    match: (p: string) => p.startsWith('/guard/expected'),
  },
  {
    href: '/guard/check-in',
    label: 'Check-in',
    match: (p: string) => p.startsWith('/guard/check-in'),
  },
  {
    href: '/guard/walk-in',
    label: 'Walk-in',
    match: (p: string) => p.startsWith('/guard/walk-in'),
  },
  {
    href: '/guard/parcels',
    label: 'Parcels',
    match: (p: string) => p.startsWith('/guard/parcels'),
  },
  {
    href: '/guard/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/guard/settings'),
  },
] as const;

/**
 * Minimal shell for SECURITY_GUARD on the web. Guards only need the visitor
 * verification / log surface — they get no resident or management navigation.
 * The full guard UX (QR scanning, check-in/out) lives in the mobile app.
 */
export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready } = useRoleGuard('guard');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const signOut = useSignOut();

  React.useEffect(() => {
    for (const item of GUARD_NAV) prefetchRoute(router, item.href);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center sr-muted text-sm">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--sr-bg))]">
      <header className="sticky top-0 z-20 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Link
          href="/guard"
          aria-label="SmartResidence Gate home"
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 min-w-0 leading-tight"
        >
          <ShieldCheck
            className="row-start-1 self-center size-5 shrink-0 text-coral-500"
            aria-hidden
          />
          <div className="row-start-1 min-w-0 text-xl font-bold tracking-tight truncate">
            Smart<span className="text-coral-500">Residence</span>
            <span className="mx-1.5 font-normal opacity-40" aria-hidden>
              ·
            </span>
            <span className="font-semibold">Gate</span>
          </div>
          {condo ? (
            <div className="col-start-2 row-start-2 text-xs sr-muted truncate">{condo.name}</div>
          ) : null}
        </Link>
        <nav
          aria-label="Gate navigation"
          className="flex items-center gap-0.5 shrink-0 flex-nowrap"
        >
          {GUARD_NAV.filter((item) => item.href !== '/guard/settings').map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={item.match(pathname) ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute(router, item.href)}
              onFocus={() => prefetchRoute(router, item.href)}
              className={cn(
                'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                item.match(pathname)
                  ? 'text-coral-500 bg-coral-500/10'
                  : 'hover:bg-[rgb(var(--sr-border))]/40',
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/guard/settings"
            prefetch
            aria-current={pathname.startsWith('/guard/settings') ? 'page' : undefined}
            onMouseEnter={() => prefetchRoute(router, '/guard/settings')}
            onFocus={() => prefetchRoute(router, '/guard/settings')}
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
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 max-w-5xl w-full mx-auto pb-20 md:pb-10">
        <PageFade>{children}</PageFade>
      </main>
      <MobileTabBar
        ariaLabel="Gate navigation"
        items={[
          { href: '/guard', label: 'Live', isActive: (p) => p === '/guard' },
          {
            href: '/guard/expected',
            label: 'Expected',
            isActive: (p) => p.startsWith('/guard/expected'),
          },
          {
            href: '/guard/check-in',
            label: 'Check-in',
            isActive: (p) => p.startsWith('/guard/check-in'),
          },
          {
            href: '/guard/walk-in',
            label: 'Walk-in',
            isActive: (p) => p.startsWith('/guard/walk-in'),
          },
          {
            href: '/guard/parcels',
            label: 'Parcels',
            isActive: (p) => p.startsWith('/guard/parcels'),
          },
        ]}
      />
    </div>
  );
}
