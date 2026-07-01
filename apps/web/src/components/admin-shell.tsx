'use client';

import { MobileTabBar } from '@/components/mobile-tab-bar';
import { NotificationBell } from '@/components/notification-bell';
import { GenericPageSkeleton, ShellNavSkeleton } from '@/components/route-skeletons';
import { NavLinks, PageFade } from '@/components/shell-nav';
import { api, readSession } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useSignOut } from '@/lib/use-sign-out';
import { useMyCondos, useSetupStatus } from '@smartresidence/api-client';
import { ROLE_LABEL } from '@smartresidence/shared-types';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Gavel,
  HelpCircle,
  Landmark,
  LifeBuoy,
  LogOut,
  MapPin,
  Megaphone,
  Package,
  Rocket,
  Search,
  Settings2,
  ShieldAlert,
  Siren,
  Store,
  Vote,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
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
    href: '/admin/platform',
    label: 'All condos',
    icon: Store,
    can: { action: 'read', subject: 'Platform' },
  },
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
    href: '/admin/parcels',
    label: 'Parcels',
    icon: Package,
    can: { action: 'read', subject: 'Parcel' },
  },
  {
    href: '/admin/invoices',
    label: 'Invoices',
    icon: CreditCard,
    can: { action: 'read', subject: 'Invoice' },
  },
  {
    href: '/admin/deposits',
    label: 'Deposits',
    icon: Wallet,
    can: { action: 'read', subject: 'Deposit' },
  },
  {
    href: '/admin/accounting',
    label: 'Accounting',
    icon: Landmark,
    can: { action: 'read', subject: 'Ledger' },
  },
  {
    href: '/admin/safety',
    label: 'Safety / SOS',
    icon: Siren,
    can: { action: 'read', subject: 'SosAlert' },
  },
  {
    href: '/admin/patrol',
    label: 'Patrol',
    icon: MapPin,
    can: { action: 'read', subject: 'PatrolCheckpoint' },
  },
  {
    href: '/admin/defects',
    label: 'Defects',
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
  {
    href: '/admin/polls',
    label: 'Owner polls',
    icon: Vote,
    can: { action: 'manage', subject: 'Poll' },
  },
  {
    href: '/admin/lost-found',
    label: 'Lost & found',
    icon: Search,
    can: { action: 'manage', subject: 'LostFoundPost' },
  },
  {
    href: '/admin/governance',
    label: 'Governance',
    icon: Gavel,
    can: { action: 'manage', subject: 'GeneralMeeting' },
  },
  {
    href: '/admin/facilities',
    label: 'Facilities',
    icon: CalendarDays,
    can: { action: 'manage', subject: 'Facility' },
  },
  {
    href: '/admin/forms',
    label: 'Forms',
    icon: ClipboardList,
    can: { action: 'read', subject: 'FormSubmission' },
  },
  {
    href: '/admin/documents',
    label: 'Documents',
    icon: FileText,
    can: { action: 'manage', subject: 'Document' },
  },
  { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, can: { action: 'manage', subject: 'Faq' } },
  { href: '/admin/settings', label: 'Settings', icon: Settings2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, abilities, ready } = useRoleGuard('admin');
  const condos = useMyCondos(api);
  const activeCondoId = readSession()?.activeCondoId ?? null;
  const condo = condos.data?.find((c) => c.id === activeCondoId) ?? condos.data?.[0];
  const signOut = useSignOut();

  // Only management admins can drive first-time setup; surface a Setup entry
  // point until the building is marked configured.
  const canManageCondo = hasAbility(abilities, 'manage', 'Condo');
  const setup = useSetupStatus(api, canManageCondo ? (condo?.id ?? null) : null);
  const setupIncomplete = Boolean(setup.data && !setup.data.completedAt && !setup.data.dismissedAt);

  // Incomplete setup is surfaced via the dashboard banner and optional "Finish setup"
  // nav item — admins are never redirected away from other admin pages.

  const navItems = React.useMemo(() => {
    const items = NAV.filter(
      (item) => !item.can || hasAbility(abilities, item.can.action, item.can.subject),
    );
    if (setupIncomplete) {
      return [{ href: '/admin/setup', label: 'Finish setup', icon: Rocket }, ...items];
    }
    return items;
  }, [abilities, setupIncomplete]);

  if (!ready) {
    return (
      <div className="min-h-screen flex bg-[rgb(var(--sr-bg))]">
        <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
          <div className="text-xl font-bold tracking-tight px-2 mb-6 mt-2">
            Smart<span className="text-coral-500">Residence</span>
          </div>
          <ShellNavSkeleton count={NAV.length} />
        </aside>
        <main className="flex-1 min-w-0 p-6 md:p-10">
          <GenericPageSkeleton />
        </main>
      </div>
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
          className="flex items-center gap-2 px-3 py-2 mt-4 rounded-xl touch-manipulation transition-[background-color] duration-100 hover:bg-[rgb(var(--sr-border))]/40 text-sm"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 md:px-10 py-3 flex items-center justify-end">
          <NotificationBell />
        </header>
        <div className="p-4 sm:p-6 md:p-10 pb-20 md:pb-10">
          {canManageCondo && setup.isError ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3 text-sm"
            >
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p>
                Could not load setup status. Some reminders may be missing until the API is
                available again ({'http://localhost:4000'}).
              </p>
            </div>
          ) : null}
          <PageFade>{children}</PageFade>
        </div>
      </main>
      <MobileTabBar
        ariaLabel="Management navigation"
        items={navItems.slice(0, 5).map((item) => ({
          href: item.href,
          label: item.label,
          isActive: (p) =>
            p === item.href || (item.href !== '/admin' && p.startsWith(`${item.href}/`)),
        }))}
      />
    </div>
  );
}
