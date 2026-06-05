import type { ThreadMessageItem } from '@smartresidence/api-client';

/** Short time for message metadata (today → time only; else short date + time). */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function authorInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 1).toUpperCase();
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

export type MessageAlignment = 'left' | 'right';

export function messageAlignment(
  message: ThreadMessageItem,
  opts: {
    variant: 'admin' | 'resident';
    viewerId?: string;
    residentId?: string;
  },
): MessageAlignment {
  const isResidentAuthor = Boolean(opts.residentId && message.author?.id === opts.residentId);
  if (opts.variant === 'admin') {
    return isResidentAuthor ? 'left' : 'right';
  }
  const isMine = Boolean(opts.viewerId && message.author?.id === opts.viewerId);
  return isMine ? 'right' : 'left';
}

export function displayAuthorName(
  message: ThreadMessageItem,
  opts: {
    variant: 'admin' | 'resident';
    viewerId?: string;
    residentId?: string;
  },
): string {
  const isResidentAuthor = Boolean(opts.residentId && message.author?.id === opts.residentId);
  if (opts.variant === 'resident') {
    if (message.author?.id === opts.viewerId) return 'You';
    return message.author?.name ?? 'Management';
  }
  return message.author?.name ?? (isResidentAuthor ? 'Resident' : 'Staff');
}
