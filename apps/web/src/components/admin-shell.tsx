'use client';

import { NavLinks, PageFade } from '@/components/shell-nav';
import { api, writeSession } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useMyCondos } from '@smartresidence/api-client';
import { ROLE_LABEL } from '@smartresidence/shared-types';
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  LogOut,
  Megaphone,
  Settings2,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * Management navigation. Items are filtered by the user's abilities so
 * MANAGEMENT_STAFF (no audit-log read, no role management) sees a narrower menu
 * than MANAGEMENT_ADMIN / SUPER_ADMIN.
 */
const NAV: Array<{
  href: string;
  label: string;
  icon: typeof BarChart3;
  can?: { action: string; subject: string };
}> = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  {
    href: '/admin/units',
    label: 'Residents & units',
    icon: Building2,
    can: { action: 'read', subject: 'Unit' },
  },
  {
    href: '/admin/visitors',
    label: 'Visitors',
    icon: CalendarClock,
    can: { action: 'read', subject: 'Visitor' },
  },
  {
    href: '/admin/invoices',
    label: 'Invoices',
    icon: CreditCard,
    can: { action: 'read', subject: 'Invoice' },
  },
  {
    href: '/admin/defects',
    label: 'Defect board',
    icon: Wrench,
    can: { action: 'read', subject: 'Defect' },
  },
  {
    href: '/admin/helpdesk',
    label: 'Helpdesk',
    icon: LifeBuoy,
    can: { action: 'read', subject: 'Thread' },
  },
  {
    href: '/admin/announcements',
    label: 'Announcements',
    icon: Megaphone,
    can: { action: 'publish', subject: 'Announcement' },
  },
  { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, can: { action: 'manage', subject: 'Faq' } },
  { href: '/admin/settings', label: 'Settings', icon: Settings2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { role, abilities, ready } = useRoleGuard('admin');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  const navItems = React.useMemo(
    () =>
      NAV.filter((item) => !item.can || hasAbility(abilities, item.can.action, item.can.subject)),
    [abilities],
  );

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
    <div className="min-h-screen flex bg-[rgb(var(--sr-bg))]">
      <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
        <Link href="/admin" className="text-xl font-bold tracking-tight px-2 mb-1 mt-2">
          Smart<span className="text-coral-500">Residence</span>
        </Link>
        <div className="px-2 text-meta mb-6 flex items-center gap-1.5">
          <ShieldAlert className="size-3" />{' '}
          {role === 'SUPER_ADMIN' ? 'Platform portal' : 'Management portal'}
        </div>
        {role ? (
          <div className="px-2 text-meta -mt-4 mb-6 leading-none">{ROLE_LABEL[role]}</div>
        ) : null}
        {condo ? (
          <div className="px-3 py-2 mb-4 rounded-xl bg-[rgb(var(--sr-card))] text-sm font-medium border border-[rgb(var(--sr-border))]">
            {condo.name}
          </div>
        ) : null}
        <NavLinks items={navItems} />
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 mt-4 rounded-xl hover:bg-[rgb(var(--sr-border))]/40 text-sm"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-6 md:p-10">
        <PageFade>{children}</PageFade>
      </main>
    </div>
  );
}
