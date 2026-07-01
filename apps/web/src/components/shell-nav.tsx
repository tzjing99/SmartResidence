'use client';

import { resolveActiveHref } from '@/lib/nav';
import { cn } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** When true, the group starts collapsed (e.g. rarely-used links). */
  defaultCollapsed?: boolean;
}

function prefetchRoute(router: ReturnType<typeof useRouter>, href: string) {
  try {
    router.prefetch(href);
  } catch {
    /* ignore prefetch failures */
  }
}

export { prefetchRoute };

/**
 * Shared sidebar navigation used by the resident and management shells.
 *
 * Active state is computed with the centralized longest-prefix rule
 * (`resolveActiveHref`) so an index route like `/admin` no longer stays stuck
 * active on `/admin/units`. The active pill slides between items via a shared
 * `layoutId`; when the user prefers reduced motion the slide is disabled and
 * the highlight snaps instantly. The active link also carries
 * `aria-current="page"` for accessibility and reliable testing.
 *
 * Routes are prefetched on hover/focus so warm navigations skip the RSC round-trip.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const groupId = React.useId();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const activeHref = React.useMemo(
    () =>
      resolveActiveHref(
        pathname,
        items.map((i) => i.href),
      ),
    [pathname, items],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset optimistic highlight when route changes
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Warm likely next routes once the shell mounts.
  React.useEffect(() => {
    for (const item of items) prefetchRoute(router, item.href);
  }, [items, router]);

  return (
    <nav className="flex-1 flex flex-col gap-1">
      <LayoutGroup id={groupId}>
        {items.map((item) => {
          const active = item.href === activeHref || item.href === pendingHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={item.href === activeHref ? 'page' : undefined}
              onPointerDown={() => setPendingHref(item.href)}
              onMouseEnter={() => prefetchRoute(router, item.href)}
              onFocus={() => prefetchRoute(router, item.href)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium touch-manipulation',
                'transition-[color,background-color] duration-100 outline-none',
                'focus-visible:ring-2 focus-visible:ring-coral-500/50',
                active ? 'text-coral-500' : 'text-[inherit] hover:bg-[rgb(var(--sr-border))]/40',
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-xl bg-coral-500/10"
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                  }
                />
              ) : null}
              <Icon className="size-4 relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}

function NavLinkItem({
  item,
  active,
  pending,
  onPointerDown,
  onWarm,
  reduceMotion,
}: {
  item: NavItem;
  active: boolean;
  pending: boolean;
  onPointerDown: () => void;
  onWarm: () => void;
  reduceMotion: boolean | null;
}) {
  const Icon = item.icon;
  const highlighted = active || pending;
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? 'page' : undefined}
      onPointerDown={onPointerDown}
      onMouseEnter={onWarm}
      onFocus={onWarm}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium touch-manipulation',
        'transition-[color,background-color] duration-100 outline-none',
        'focus-visible:ring-2 focus-visible:ring-coral-500/50',
        highlighted ? 'text-coral-500' : 'text-[inherit] hover:bg-[rgb(var(--sr-border))]/40',
      )}
    >
      {highlighted ? (
        <motion.span
          layoutId="nav-active-pill"
          aria-hidden
          className="absolute inset-0 rounded-xl bg-coral-500/10"
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
          }
        />
      ) : null}
      <Icon className="size-4 relative z-10" />
      <span className="relative z-10">{item.label}</span>
    </Link>
  );
}

/**
 * Grouped sidebar navigation with section labels and optional collapse.
 * Used by the management shell to reduce visual noise while keeping all routes.
 */
export function NavGroupLinks({
  topItems = [],
  groups,
  bottomItems = [],
}: {
  topItems?: NavItem[];
  groups: NavGroup[];
  bottomItems?: NavItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const groupId = React.useId();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  const allItems = React.useMemo(
    () => [...topItems, ...groups.flatMap((g) => g.items), ...bottomItems],
    [topItems, groups, bottomItems],
  );

  const activeHref = React.useMemo(
    () =>
      resolveActiveHref(
        pathname,
        allItems.map((i) => i.href),
      ),
    [pathname, allItems],
  );

  const activeInGroup = React.useCallback(
    (group: NavGroup) => group.items.some((item) => item.href === activeHref),
    [activeHref],
  );

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of groups) {
      if (g.defaultCollapsed) init[g.label] = true;
    }
    return init;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset optimistic highlight when route changes
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  React.useEffect(() => {
    for (const item of allItems) prefetchRoute(router, item.href);
  }, [allItems, router]);

  // Expand a collapsed group when navigating to one of its items.
  React.useEffect(() => {
    for (const g of groups) {
      if (g.defaultCollapsed && activeInGroup(g)) {
        setCollapsed((prev) => (prev[g.label] ? { ...prev, [g.label]: false } : prev));
      }
    }
  }, [groups, activeInGroup]);

  const renderItem = (item: NavItem) => (
    <NavLinkItem
      key={item.href}
      item={item}
      active={item.href === activeHref}
      pending={item.href === pendingHref}
      reduceMotion={reduceMotion}
      onPointerDown={() => setPendingHref(item.href)}
      onWarm={() => prefetchRoute(router, item.href)}
    />
  );

  return (
    <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0">
      <LayoutGroup id={groupId}>
        {topItems.map(renderItem)}
        {groups.map((group) => {
          const isCollapsed = collapsed[group.label] ?? false;
          const canCollapse = Boolean(group.defaultCollapsed);
          return (
            <div key={group.label} className="mt-3 first:mt-0">
              {canCollapse ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.label]: !isCollapsed }))}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide sr-muted hover:text-[rgb(var(--sr-fg))] transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  {group.label}
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', isCollapsed ? '' : 'rotate-180')}
                    aria-hidden
                  />
                </button>
              ) : (
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide sr-muted">
                  {group.label}
                </div>
              )}
              {!isCollapsed ? (
                <div className="flex flex-col gap-0.5">{group.items.map(renderItem)}</div>
              ) : null}
            </div>
          );
        })}
        {bottomItems.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-[rgb(var(--sr-border))]/60 flex flex-col gap-0.5">
            {bottomItems.map(renderItem)}
          </div>
        ) : null}
      </LayoutGroup>
    </nav>
  );
}

/** Pass-through wrapper — route transitions use loading.tsx skeletons instead. */
export function PageFade({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
