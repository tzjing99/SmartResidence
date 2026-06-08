'use client';

import { resolveActiveHref } from '@/lib/nav';
import { cn } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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

/** Pass-through wrapper — route transitions use loading.tsx skeletons instead. */
export function PageFade({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
