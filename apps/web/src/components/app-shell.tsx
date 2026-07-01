'use client';

import { MobileTabBar } from '@/components/mobile-tab-bar';
import { NotificationBell } from '@/components/notification-bell';
import { ResidentMobileMenu } from '@/components/resident-mobile-menu';
import { DashboardSkeleton, ShellNavSkeleton } from '@/components/route-skeletons';
import { type NavGroup, NavGroupLinks, PageFade } from '@/components/shell-nav';
import { api } from '@/lib/api';
import { resolveActiveHref } from '@/lib/nav';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useSignOut } from '@/lib/use-sign-out';
import { useMyCondos } from '@smartresidence/api-client';
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  Gavel,
  HelpCircle,
  History,
  Home,
  KeyRound,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
  Search,
  Settings2,
  Vote,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { href: '/dashboard', label: 'Home', icon: Home },
      {
        href: '/visitors',
        label: 'Visitors',
        icon: CalendarClock,
      },
      {
        href: '/parcels',
        label: 'Parcels',
        icon: Package,
      },
      {
        href: '/billing',
        label: 'Fees',
        icon: CreditCard,
      },
      {
        href: '/defects',
        label: 'Defects',
        icon: Wrench,
      },
      {
        href: '/messages',
        label: 'Messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    label: 'Community',
    items: [
      {
        href: '/announcements',
        label: 'Announcements',
        icon: Megaphone,
      },
      {
        href: '/polls',
        label: 'Polls',
        icon: Vote,
      },
      {
        href: '/lost-found',
        label: 'Lost & found',
        icon: Search,
      },
      {
        href: '/governance',
        label: 'Governance',
        icon: Gavel,
      },
      {
        href: '/facilities',
        label: 'Facilities',
        icon: CalendarDays,
      },
      {
        href: '/forms',
        label: 'Forms',
        icon: ClipboardList,
      },
      {
        href: '/documents',
        label: 'Documents',
        icon: FileText,
      },
      { href: '/faq', label: 'Help', icon: HelpCircle },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings2 },
      { href: '/activity', label: 'My activity', icon: History },
      { href: '/who-viewed', label: 'Who viewed me', icon: Eye },
      {
        href: '/access',
        label: 'Manage access',
        icon: KeyRound,
      },
    ],
  },
];

/** Ability gates — filtered before rendering nav. */
const NAV_CAN: Record<string, { action: string; subject: string }> = {
  '/visitors': { action: 'read', subject: 'Visitor' },
  '/parcels': { action: 'read', subject: 'Parcel' },
  '/billing': { action: 'read', subject: 'Invoice' },
  '/defects': { action: 'read', subject: 'Defect' },
  '/messages': { action: 'read', subject: 'Thread' },
  '/announcements': { action: 'read', subject: 'Announcement' },
  '/polls': { action: 'read', subject: 'Poll' },
  '/lost-found': { action: 'read', subject: 'LostFoundPost' },
  '/governance': { action: 'read', subject: 'GeneralMeeting' },
  '/facilities': { action: 'read', subject: 'Facility' },
  '/forms': { action: 'read', subject: 'FormTemplate' },
  '/documents': { action: 'read', subject: 'Document' },
  '/faq': { action: 'read', subject: 'Faq' },
  '/access': { action: 'revoke', subject: 'RoleAssignment' },
};

const MOBILE_TAB_HREFS = ['/dashboard', '/visitors', '/parcels', '/billing', '/defects'] as const;

function filterNavGroups(groups: NavGroup[], abilities: AbilityRule[]) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const gate = NAV_CAN[item.href];
        return !gate || hasAbility(abilities, gate.action, gate.subject);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function flattenNavItems(groups: NavGroup[]) {
  return groups.flatMap((g) => g.items);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, abilities, ready } = useRoleGuard('resident');
  const condos = useMyCondos(api);
  const signOut = useSignOut();

  const navSections = React.useMemo(() => filterNavGroups(NAV_GROUPS, abilities ?? []), [abilities]);
  const navItems = React.useMemo(() => flattenNavItems(navSections), [navSections]);

  const mobileTabItems = React.useMemo(
    () =>
      MOBILE_TAB_HREFS.map((href) => navItems.find((i) => i.href === href)).filter(
        (item): item is (typeof navItems)[number] => item != null,
      ),
    [navItems],
  );

  const activeLabel =
    navItems.find(
      (i) =>
        i.href ===
        resolveActiveHref(
          pathname,
          navItems.map((n) => n.href),
        ),
    )?.label ?? 'SmartResidence';

  const condo = condos.data?.[0];

  if (!ready) {
    return (
      <div className="min-h-screen flex">
        <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
          <div className="text-xl font-bold tracking-tight px-2 mb-6 mt-2">
            Smart<span className="text-coral-500">Residence</span>
          </div>
          <ShellNavSkeleton count={flattenNavItems(NAV_GROUPS).length} />
        </aside>
        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 py-3">
            <div className="h-5 w-24 rounded bg-[rgb(var(--sr-border))]/30 animate-shimmer" />
          </header>
          <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
            <DashboardSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight px-2 mb-2 mt-2">
          Smart<span className="text-coral-500">Residence</span>
        </Link>
        {condo ? <div className="px-2 text-xs sr-muted mb-4 truncate">{condo.name}</div> : null}

        <NavGroupLinks groups={navSections} />

        <div className="border-t border-[rgb(var(--sr-border))] pt-4 mt-4 flex flex-col gap-2 shrink-0">
          {me.data ? (
            <div className="text-xs sr-muted px-2 truncate">
              {(me.data as { user?: { name?: string; email?: string } }).user?.name} ·{' '}
              {(me.data as { user?: { name?: string; email?: string } }).user?.email}
            </div>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-xl touch-manipulation transition-[background-color] duration-100 hover:bg-[rgb(var(--sr-border))]/40 text-sm"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/80 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ResidentMobileMenu items={navItems} />
            <h1 className="text-base font-semibold tracking-tight truncate">{activeLabel}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
        <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full pb-20 md:pb-10">
          <PageFade>{children}</PageFade>
        </div>
      </main>
      <MobileTabBar
        ariaLabel="Resident navigation"
        items={mobileTabItems.map((item) => ({
          href: item.href,
          label: item.label,
          icon: item.icon,
          isActive: (p) =>
            p === item.href || (item.href !== '/dashboard' && p.startsWith(`${item.href}/`)),
        }))}
      />
    </div>
  );
}
