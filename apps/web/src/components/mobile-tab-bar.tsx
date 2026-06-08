'use client';

import { prefetchRoute } from '@/components/shell-nav';
import { cn } from '@smartresidence/ui-web';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

export interface MobileTabItem {
  href: string;
  label: string;
  isActive?: (pathname: string) => boolean;
}

/**
 * Fixed bottom tab bar for phone-width web shells (hidden from md breakpoint up).
 */
export function MobileTabBar({
  items,
  ariaLabel,
}: {
  items: MobileTabItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    for (const item of items) prefetchRoute(router, item.href);
  }, [items, router]);

  return (
    <nav
      aria-label={ariaLabel}
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex">
        {items.map((item) => {
          const active = item.isActive
            ? item.isActive(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute(router, item.href)}
              onFocus={() => prefetchRoute(router, item.href)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-12 touch-manipulation text-[11px] font-semibold transition-colors',
                active ? 'text-coral-500' : 'sr-muted hover:text-[rgb(var(--sr-fg))]',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
