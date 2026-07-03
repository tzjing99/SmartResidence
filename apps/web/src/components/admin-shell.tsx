'use client';

import { MobileTabBar } from '@/components/mobile-tab-bar';
import { NotificationBell } from '@/components/notification-bell';
import { GenericPageSkeleton, ShellNavSkeleton } from '@/components/route-skeletons';
import { type NavGroup, NavGroupLinks, type NavItem, PageFade } from '@/components/shell-nav';
import { useT } from '@/i18n/locale-provider';
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
  Receipt,
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

type NavDef = Omit<NavItem, 'label'> & {
  labelKey: string;
  can?: { action: string; subject: string };
};

/**
 * Management navigation definitions. Items are filtered by CASL abilities so
 * MANAGEMENT_STAFF sees a narrower menu than MANAGEMENT_ADMIN / SUPER_ADMIN.
 */
const NAV_DEFS: NavDef[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', icon: BarChart3 },
  {
    href: '/admin/platform',
    labelKey: 'admin.nav.platform',
    icon: Store,
    can: { action: 'read', subject: 'Platform' },
  },
  {
    href: '/admin/units',
    labelKey: 'admin.nav.units',
    icon: Building2,
    can: { action: 'read', subject: 'Unit' },
  },
  {
    href: '/admin/visitors',
    labelKey: 'admin.nav.visitors',
    icon: CalendarClock,
    can: { action: 'read', subject: 'Visitor' },
  },
  {
    href: '/admin/parcels',
    labelKey: 'admin.nav.parcels',
    icon: Package,
    can: { action: 'read', subject: 'Parcel' },
  },
  {
    href: '/admin/invoices',
    labelKey: 'admin.nav.invoices',
    icon: CreditCard,
    can: { action: 'read', subject: 'Invoice' },
  },
  {
    href: '/admin/deposits',
    labelKey: 'admin.nav.deposits',
    icon: Wallet,
    can: { action: 'read', subject: 'Deposit' },
  },
  {
    href: '/admin/accounting',
    labelKey: 'admin.nav.accounting',
    icon: Landmark,
    can: { action: 'read', subject: 'Ledger' },
  },
  {
    href: '/admin/procurement',
    labelKey: 'admin.nav.procurement',
    icon: Receipt,
    can: { action: 'read', subject: 'VendorBill' },
  },
  {
    href: '/admin/compliance/cob',
    labelKey: 'admin.nav.cobForms',
    icon: FileText,
    can: { action: 'read', subject: 'Ledger' },
  },
  {
    href: '/admin/safety',
    labelKey: 'admin.nav.safety',
    icon: Siren,
    can: { action: 'read', subject: 'SosAlert' },
  },
  {
    href: '/admin/patrol',
    labelKey: 'admin.nav.patrol',
    icon: MapPin,
    can: { action: 'read', subject: 'PatrolCheckpoint' },
  },
  {
    href: '/admin/defects',
    labelKey: 'admin.nav.defects',
    icon: Wrench,
    can: { action: 'read', subject: 'Defect' },
  },
  {
    href: '/admin/helpdesk',
    labelKey: 'admin.nav.helpdesk',
    icon: LifeBuoy,
    can: { action: 'read', subject: 'Thread' },
  },
  {
    href: '/admin/announcements',
    labelKey: 'admin.nav.announcements',
    icon: Megaphone,
    can: { action: 'publish', subject: 'Announcement' },
  },
  {
    href: '/admin/polls',
    labelKey: 'admin.nav.polls',
    icon: Vote,
    can: { action: 'manage', subject: 'Poll' },
  },
  {
    href: '/admin/lost-found',
    labelKey: 'admin.nav.lostFound',
    icon: Search,
    can: { action: 'manage', subject: 'LostFoundPost' },
  },
  {
    href: '/admin/governance',
    labelKey: 'admin.nav.governance',
    icon: Gavel,
    can: { action: 'manage', subject: 'GeneralMeeting' },
  },
  {
    href: '/admin/facilities',
    labelKey: 'admin.nav.facilities',
    icon: CalendarDays,
    can: { action: 'manage', subject: 'Facility' },
  },
  {
    href: '/admin/forms',
    labelKey: 'admin.nav.forms',
    icon: ClipboardList,
    can: { action: 'read', subject: 'FormSubmission' },
  },
  {
    href: '/admin/documents',
    labelKey: 'admin.nav.documents',
    icon: FileText,
    can: { action: 'manage', subject: 'Document' },
  },
  {
    href: '/admin/faq',
    labelKey: 'admin.nav.faq',
    icon: HelpCircle,
    can: { action: 'manage', subject: 'Faq' },
  },
  { href: '/admin/settings', labelKey: 'admin.nav.settings', icon: Settings2 },
];

/** Map href → nav item for grouping. */
const NAV_BY_HREF = Object.fromEntries(NAV_DEFS.map((d) => [d.href, d])) as Record<string, NavDef>;

const NAV_GROUP_SPECS: Array<{
  labelKey: string;
  hrefs: string[];
  defaultCollapsed?: boolean;
}> = [
  {
    labelKey: 'admin.sections.operations',
    hrefs: [
      '/admin/visitors',
      '/admin/parcels',
      '/admin/defects',
      '/admin/helpdesk',
      '/admin/announcements',
      '/admin/facilities',
      '/admin/safety',
      '/admin/patrol',
    ],
  },
  {
    labelKey: 'admin.sections.money',
    hrefs: ['/admin/invoices', '/admin/deposits', '/admin/accounting', '/admin/procurement'],
  },
  {
    labelKey: 'admin.sections.people',
    hrefs: ['/admin/units'],
  },
  {
    labelKey: 'admin.sections.compliance',
    hrefs: ['/admin/compliance/cob', '/admin/governance', '/admin/polls'],
  },
  {
    labelKey: 'admin.sections.more',
    defaultCollapsed: true,
    hrefs: ['/admin/lost-found', '/admin/forms', '/admin/documents', '/admin/faq'],
  },
];

function filterNavItem(
  def: NavDef,
  abilities: ReturnType<typeof useRoleGuard>['abilities'],
): boolean {
  return !def.can || hasAbility(abilities, def.can.action, def.can.subject);
}

function toNavItem(def: NavDef, t: (key: string) => string): NavItem {
  return { href: def.href, label: t(def.labelKey), icon: def.icon };
}

function buildNavStructure(
  abilities: ReturnType<typeof useRoleGuard>['abilities'],
  setupIncomplete: boolean,
  t: (key: string) => string,
) {
  const visible = NAV_DEFS.filter((d) => filterNavItem(d, abilities));

  const topItems: NavItem[] = [];
  if (setupIncomplete) {
    topItems.push({ href: '/admin/setup', label: t('admin.nav.finishSetup'), icon: Rocket });
  }
  const dashboard = NAV_BY_HREF['/admin'];
  if (dashboard) topItems.push(toNavItem(dashboard, t));

  const platform = visible.find((d) => d.href === '/admin/platform');
  if (platform) topItems.push(toNavItem(platform, t));

  const groups: NavGroup[] = NAV_GROUP_SPECS.map((spec) => ({
    label: t(spec.labelKey),
    defaultCollapsed: spec.defaultCollapsed,
    items: spec.hrefs
      .map((href) => visible.find((d) => d.href === href))
      .filter((d): d is NavDef => Boolean(d))
      .map((d) => toNavItem(d, t)),
  })).filter((g) => g.items.length > 0);

  const settings = visible.find((d) => d.href === '/admin/settings');
  const bottomItems = settings ? [toNavItem(settings, t)] : [];

  const flatItems = [...topItems, ...groups.flatMap((g) => g.items), ...bottomItems];

  return { topItems, groups, bottomItems, flatItems };
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { role, abilities, ready } = useRoleGuard('admin');
  const condos = useMyCondos(api);
  const activeCondoId = readSession()?.activeCondoId ?? null;
  const condo = condos.data?.find((c) => c.id === activeCondoId) ?? condos.data?.[0];
  const signOut = useSignOut();

  const canManageCondo = hasAbility(abilities, 'manage', 'Condo');
  const setup = useSetupStatus(api, canManageCondo ? (condo?.id ?? null) : null);
  const setupIncomplete = Boolean(setup.data && !setup.data.completedAt && !setup.data.dismissedAt);

  const nav = React.useMemo(
    () => buildNavStructure(abilities, setupIncomplete, t),
    [abilities, setupIncomplete, t],
  );

  if (!ready) {
    return (
      <div className="min-h-screen flex bg-[rgb(var(--sr-bg))]">
        <aside className="w-64 border-r border-[rgb(var(--sr-border))] hidden md:flex md:flex-col p-4 sticky top-0 h-screen">
          <div className="text-xl font-bold tracking-tight px-2 mb-6 mt-2">
            Smart<span className="text-coral-500">Residence</span>
          </div>
          <ShellNavSkeleton count={NAV_DEFS.length} />
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
        <div className="px-2 text-meta mb-4 flex items-center gap-1.5">
          <ShieldAlert className="size-3" aria-hidden />
          {role === 'SUPER_ADMIN' ? t('admin.portal.platform') : t('admin.portal.management')}
        </div>
        {role ? (
          <div className="px-2 text-meta -mt-2 mb-4 leading-none">{ROLE_LABEL[role]}</div>
        ) : null}
        {condo ? (
          <div className="px-3 py-2 mb-3 rounded-xl bg-[rgb(var(--sr-card))] text-sm font-medium border border-[rgb(var(--sr-border))] truncate">
            {condo.name}
          </div>
        ) : null}
        <NavGroupLinks topItems={nav.topItems} groups={nav.groups} bottomItems={nav.bottomItems} />
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 mt-3 rounded-xl touch-manipulation transition-[background-color] duration-100 hover:bg-[rgb(var(--sr-border))]/40 text-sm"
        >
          <LogOut className="size-4" />
          {t('nav.signOut')}
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 backdrop-blur bg-[rgb(var(--sr-bg))]/90 border-b border-[rgb(var(--sr-border))] px-4 sm:px-6 md:px-10 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0 md:hidden">
            <p className="text-sm font-semibold truncate">
              {condo?.name ?? t('admin.portal.management')}
            </p>
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
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
                available again.
              </p>
            </div>
          ) : null}
          <PageFade>{children}</PageFade>
        </div>
      </main>
      <MobileTabBar
        ariaLabel={t('admin.navAria')}
        items={nav.flatItems.slice(0, 5).map((item) => ({
          href: item.href,
          label: item.label,
          isActive: (p) =>
            p === item.href || (item.href !== '/admin' && p.startsWith(`${item.href}/`)),
        }))}
      />
    </div>
  );
}
