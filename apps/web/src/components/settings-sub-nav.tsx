'use client';

import { resolveActiveHref } from '@/lib/nav';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { cn } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const reduceMotion = useReducedMotion();
  const groupId = React.useId();

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
      <nav
        aria-label="Settings sections"
        className="flex flex-wrap gap-1 border-b border-[rgb(var(--sr-border))] pb-px"
      >
        <LayoutGroup id={groupId}>
          {visibleItems.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center px-4 h-10 text-sm font-medium leading-none transition-colors duration-200 outline-none rounded-t-xl',
                  'focus-visible:ring-2 focus-visible:ring-coral-500/50',
                  active ? 'text-coral-500' : 'sr-muted hover:text-[inherit]',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="settings-subnav-active"
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-coral-500 rounded-full"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 420, damping: 34 }
                    }
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>
    </div>
  );
}
