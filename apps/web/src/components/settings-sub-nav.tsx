'use client';

import { resolveActiveHref } from '@/lib/nav';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { cn, tapScale, tapTransition } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

export interface SettingsNavItem {
  href: string;
  label: string;
  can?: { action: string; subject: string };
}

/**
 * Horizontal sub-navigation for settings sections. Filters items by CASL abilities
 * when provided and highlights the longest matching route prefix.
 */
export function SettingsSubNav({
  items,
  abilities = [],
}: {
  items: SettingsNavItem[];
  abilities?: AbilityRule[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const groupId = React.useId();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset optimistic highlight when route changes
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const visibleItems = React.useMemo(
    () =>
      items.filter((item) => !item.can || hasAbility(abilities, item.can.action, item.can.subject)),
    [items, abilities],
  );

  const activeHref = React.useMemo(
    () =>
      resolveActiveHref(
        pathname,
        visibleItems.map((i) => i.href),
      ),
    [pathname, visibleItems],
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex items-center gap-2">
        <Settings2 className="size-5 text-coral-500" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5">
        <LayoutGroup id={groupId}>
          {visibleItems.map((item) => {
            const active = item.href === activeHref || item.href === pendingHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={item.href === activeHref ? 'page' : undefined}
                onPointerDown={() => setPendingHref(item.href)}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                className={cn(
                  'relative inline-flex items-center px-4 h-9 text-sm font-medium leading-none touch-manipulation',
                  'transition-[color,background-color] duration-100 outline-none rounded-full',
                  'focus-visible:ring-2 focus-visible:ring-coral-500/50',
                  active
                    ? 'text-coral-600 dark:text-coral-400'
                    : 'sr-muted hover:text-[rgb(var(--sr-fg))] hover:bg-[rgb(var(--sr-border))]/30',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="settings-subnav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-coral-500/10 dark:bg-coral-500/15 border border-coral-500/20"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 34 }
                    }
                  />
                ) : null}
                <motion.span
                  className="relative z-10"
                  whileTap={reduceMotion ? undefined : { scale: tapScale }}
                  transition={tapTransition}
                >
                  {item.label}
                </motion.span>
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>
    </div>
  );
}
