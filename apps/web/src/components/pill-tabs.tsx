'use client';

import { cn, tapScale, tapTransition } from '@smartresidence/ui-web';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';

export interface PillTabItem<T extends string = string> {
  id: T;
  label: string;
}

/**
 * Airbnb-style segmented pill tabs for in-page views (not route navigation).
 */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: PillTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const groupId = React.useId();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto max-w-full -mx-1 px-1 pb-0.5 scrollbar-none',
        className,
      )}
    >
      <LayoutGroup id={groupId}>
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => onChange(item.id)}
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
                  layoutId={`${groupId}-pill-active`}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-coral-500/10 dark:bg-coral-500/15 border border-coral-500/20"
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
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
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
