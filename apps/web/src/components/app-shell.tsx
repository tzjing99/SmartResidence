'use client';

import { api, writeSession } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useMyCondos } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import {
  Bell,
  CalendarClock,
  CreditCard,
  Eye,
  History,
  Home,
  KeyRound,
  LogOut,
  Megaphone,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * Resident navigation. Items with a `can` clause are only shown when the
 * user's abilities (from `/api/auth/me`) permit them, so the menu matches what
 * the API will actually allow — e.g. only UNIT_OWNER sees "Manage access"
 * (revoke RoleAssignment); HOUSEHOLD_MEMBER doesn't see Fees/Defects. The
 * owner-empowerment surfaces (My activity, Who viewed me) have no ability gate
 * because their endpoints are scoped per-user and open to every resident.
 */
const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  can?: { action: string; subject: string };
}> = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/visitors', label: 'Visitors', icon: CalendarClock, can: { action: 'read', subject: 'Visitor' } },
  { href: '/billing', label: 'Fees', icon: CreditCard, can: { action: 'read', subject: 'Invoice' } },
  { href: '/defects', label: 'Defects', icon: Wrench, can: { action: 'read', subject: 'Defect' } },
  { href: '/announcements', label: 'Announcements', icon: Megaphone, can: { action: 'read', subject: 'Announcement' } },
  { href: '/activity', label: 'My activity', icon: History },
  { href: '/who-viewed', label: 'Who viewed me', icon: Eye },
  { href: '/access', label: 'Manage access', icon: KeyRound, can: { action: 'revoke', subject: 'RoleAssignment' } },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, abilities, ready } = useRoleGuard('resident');
  const condos = useMyCondos(api);

  const navItems = React.useMemo(
    () => NAV_ITEMS.filter((item) => !item.can || hasAbility(abilities, item.can.action, item.can.subject)),
    [abilities],
  );

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
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight px-2 mb-2 mt-2">
          Smart<span className="text-coral-500">Residence</span>
        </Link>
        {condo ? <div className="px-2 text-xs sr-muted mb-6 truncate">{condo.name}</div> : null}

        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-coral-500/10 text-coral-500' : 'hover:bg-[rgb(var(--sr-border))]/40',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[rgb(var(--sr-border))] pt-4 mt-4 flex flex-col gap-2">
          {me.data ? (
            <div className="text-xs sr-muted px-2 truncate">
              {(me.data as { user?: { name?: string; email?: string } }).user?.name} ·{' '}
              {(me.data as { user?: { name?: string; email?: string } }).user?.email}
            </div>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[rgb(var(--sr-border))]/40 text-sm"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-6 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">
            {navItems.find((i) => pathname.startsWith(i.href))?.label ?? 'SmartResidence'}
          </h1>
          <div className="flex items-center gap-2">
            <button type="button" className="p-2 rounded-xl hover:bg-[rgb(var(--sr-border))]/40">
              <Bell className="size-5" />
            </button>
          </div>
        </header>
        <div className="p-6 md:p-10 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
