'use client';

import { resolveActiveHref } from '@/lib/nav';
import { cn } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Shared sidebar navigation used by the resident and management shells.
 *
 * Active state is computed with the centralized longest-prefix rule
 * (`resolveActiveHref`) so an index route like `/admin` no longer stays stuck
 * active on `/admin/units`. The active pill slides between items via a shared
 * `layoutId`; when the user prefers reduced motion the slide is disabled and
 * the highlight snaps instantly. The active link also carries
 * `aria-current="page"` for accessibility and reliable testing.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
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

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
              aria-current={item.href === activeHref ? 'page' : undefined}
              onPointerDown={() => setPendingHref(item.href)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium touch-manipulation',
                'transition-[color,background-color,transform] duration-100 outline-none active:scale-[0.98]',
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

/**
 * Wraps page content in a subtle fade/slide-in that replays on each route
 * change (keyed by pathname). Disabled when the user prefers reduced motion.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0.85, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'tween', duration: 0.12, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
