'use client';

import { api } from '@/lib/api';
import { webHrefForNotification } from '@/lib/notification-href';
import {
  type NotificationItem,
  useMarkNotificationsRead,
  useNotifications,
} from '@smartresidence/api-client';
import { Badge, Skeleton, iosSpring } from '@smartresidence/ui-web';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

/** Compact relative time, e.g. "now", "2m ago", "3h ago", "5d ago". */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return 'now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return new Date(then).toLocaleDateString();
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const notifications = useNotifications(api, { limit: 20 });
  const markRead = useMarkNotificationsRead(api);

  const items: NotificationItem[] = notifications.data?.items ?? [];
  const unreadIds = React.useMemo(
    () => items.filter((n) => n.readAt == null).map((n) => n.id),
    [items],
  );
  const unreadCount = unreadIds.length;

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function markAllRead() {
    if (unreadIds.length > 0) markRead.mutate(unreadIds);
  }

  function handleItemClick(item: NotificationItem) {
    if (item.readAt == null) markRead.mutate([item.id]);
    const href = webHrefForNotification(item);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl touch-manipulation transition-[background-color] duration-100 hover:bg-[rgb(var(--sr-border))]/40"
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[rgb(var(--sr-coral))] text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            initial={
              reduceMotion
                ? undefined
                : { opacity: 0, scale: 0.95, y: -6, transformOrigin: 'top right' }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : iosSpring.snappy}
            className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--sr-border))]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 ? (
                  <Badge tone="primary">{unreadCount > 9 ? '9+' : unreadCount}</Badge>
                ) : null}
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0 || markRead.isPending}
                className="text-xs font-medium text-[rgb(var(--sr-coral))] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[70vh] sm:max-h-[420px] overflow-y-auto">
              {notifications.isLoading ? (
                <ul className="divide-y divide-[rgb(var(--sr-border))]">
                  {['sk-1', 'sk-2', 'sk-3', 'sk-4'].map((key) => (
                    <li key={key} className="px-4 py-3 flex gap-3">
                      <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-10 shrink-0" />
                        </div>
                        <Skeleton className="h-3 w-full max-w-[220px]" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm sr-muted">You're all caught up.</div>
              ) : (
                <ul className="divide-y divide-[rgb(var(--sr-border))]">
                  {items.map((item) => {
                    const unread = item.readAt == null;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left px-4 py-3 flex gap-3 transition-[background-color] duration-100 hover:bg-[rgb(var(--sr-border))]/30"
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${
                              unread ? 'bg-[rgb(var(--sr-coral))]' : 'bg-transparent'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span
                                className={`text-sm truncate ${unread ? 'font-semibold' : 'font-medium'}`}
                              >
                                {item.title}
                              </span>
                              <span className="text-[11px] sr-muted shrink-0 whitespace-nowrap">
                                {formatRelativeTime(item.createdAt)}
                              </span>
                            </span>
                            {item.body ? (
                              <span className="mt-0.5 block text-xs sr-muted line-clamp-2">
                                {item.body}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
