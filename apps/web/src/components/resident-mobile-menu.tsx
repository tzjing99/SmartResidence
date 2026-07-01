'use client';

import type { NavItem } from '@/components/shell-nav';
import { prefetchRoute } from '@/components/shell-nav';
import { resolveActiveHref } from '@/lib/nav';
import { cn } from '@smartresidence/ui-web';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

/** Overflow navigation drawer for resident shell on small screens. */
export function ResidentMobileMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const activeHref = resolveActiveHref(
    pathname,
    items.map((i) => i.href),
  );

  // Close drawer when navigating to a new route.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname drives menu visibility
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md:hidden inline-flex size-9 items-center justify-center rounded-xl border border-[rgb(var(--sr-border))] touch-manipulation hover:bg-[rgb(var(--sr-border))]/30"
        aria-expanded={open}
        aria-controls="resident-mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <div id="resident-mobile-menu" className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="Resident navigation"
            className="absolute inset-y-0 left-0 w-[min(100%,18rem)] flex flex-col gap-1 overflow-y-auto border-r border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
          >
            <div className="text-xs sr-muted uppercase tracking-wide font-semibold px-2 mb-2">
              Menu
            </div>
            {items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={() => prefetchRoute(router, item.href)}
                  onFocus={() => prefetchRoute(router, item.href)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium touch-manipulation',
                    active
                      ? 'bg-coral-500/10 text-coral-600 dark:text-coral-400'
                      : 'hover:bg-[rgb(var(--sr-border))]/40',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </>
  );
}
