'use client';

import { api, writeSession } from '@/lib/api';
import { useMe, useMyCondos } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  History,
  LogOut,
  Megaphone,
  ShieldAlert,
  UserCog,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/units', label: 'Residents & units', icon: Building2 },
  { href: '/admin/visitors', label: 'Visitors', icon: CalendarClock },
  { href: '/admin/invoices', label: 'Invoices', icon: CreditCard },
  { href: '/admin/defects', label: 'Defect board', icon: Wrench },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/audit', label: 'Audit log', icon: History },
  { href: '/admin/roles', label: 'Roles', icon: UserCog },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  React.useEffect(() => {
    if (me.error) router.push('/sign-in');
  }, [me.error, router]);

  async function signOut() {
    try {
      await api.signOut();
    } catch {
      /* ignore */
    }
    writeSession(null);
    router.push('/sign-in');
  }

  return (
    <div className="min-h-screen flex bg-[rgb(var(--sr-bg))]">
      <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
        <Link href="/admin" className="text-xl font-bold tracking-tight px-2 mb-1 mt-2">
          Smart<span className="text-coral-500">Residence</span>
        </Link>
        <div className="px-2 text-xs sr-muted mb-6 flex items-center gap-1">
          <ShieldAlert className="size-3" /> Management portal
        </div>
        {condo ? (
          <div className="px-3 py-2 mb-4 rounded-xl bg-[rgb(var(--sr-card))] text-sm font-medium border border-[rgb(var(--sr-border))]">
            {condo.name}
          </div>
        ) : null}
        <nav className="flex-1 flex flex-col gap-1">
          {NAV.map((item) => {
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
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 mt-4 rounded-xl hover:bg-[rgb(var(--sr-border))]/40 text-sm"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-6 md:p-10">{children}</main>
    </div>
  );
}
