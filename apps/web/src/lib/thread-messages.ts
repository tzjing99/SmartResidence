import type { ThreadMessageItem } from '@smartresidence/api-client';

/** Known system-event categories for helpdesk thread timeline pills. */
export type SystemEventType =
  | 'resolution_proposed'
  | 'resolution_solution_updated'
  | 'resolution_confirmed'
  | 'resolution_rejected'
  | 'resolution_auto'
  | 'appeal_reopened'
  | 'awaiting_resident'
  | 'abusive_close'
  | 'auto_close'
  | 'status_change'
  | 'generic';

export type SystemEventIcon = 'check' | 'clock' | 'x' | 'refresh' | 'user' | 'alert' | 'info';

export interface ParsedSystemEvent {
  type: SystemEventType;
  label: string;
  detail?: string;
  icon: SystemEventIcon;
}

const RESOLUTION_PROPOSED_PREFIX =
  /^Management proposed this thread as resolved — awaiting resident confirmation(?::\s*(.+))?\.?$/;
const RESOLUTION_PROPOSED_NEW = /^Marked as fixed — waiting for resident to confirm\.?$/;
const RESOLUTION_UPDATED_OLD =
  /^Management (updated the proposed solution|changed the proposed solution message)\.?$/;
const RESOLUTION_UPDATED_NEW = /^Changed which reply is the fix\.?$/;
const RESOLUTION_CONFIRMED_OLD = /^Resident confirmed the thread is resolved\.?$/;
const RESOLUTION_CONFIRMED_NEW = /^Resident confirmed — ticket closed\.?$/;
const RESOLUTION_REJECTED = /^Resident rejected the proposed resolution\.?$/;
const RESOLUTION_REJECTED_NEW = /^Resident said it's not fixed yet\.?$/;
const APPEAL_OLD = /^Resident appealed — thread reopened\.?$/;
const APPEAL_NEW = /^Resident reopened this ticket\.?$/;
const AWAITING_RESIDENT_OLD = /^Management requested a response from the resident\.?$/;
const AWAITING_RESIDENT_NEW = /^Waiting on resident to reply\.?$/;
const AUTO_RESOLVED =
  /^Automatically resolved — the resident did not respond to the resolution proposal within \d+ days\.?$/;
const AUTO_RESOLVED_NEW = /^Auto-closed — no response in time\.?$/;
const AUTO_CLOSED = /^Automatically closed — no activity for \d+ days\.?$/;
const AUTO_CLOSED_NEW = /^Closed — no activity\.?$/;
const ABUSIVE_CLOSE = /^Thread closed by management \(abusive\):\s*(.+)$/;

function parseSingleSystemLine(line: string): ParsedSystemEvent {
  const trimmed = line.trim();
  if (!trimmed) {
    return { type: 'generic', label: 'Update', icon: 'info' };
  }

  let match = trimmed.match(RESOLUTION_PROPOSED_PREFIX);
  if (match || RESOLUTION_PROPOSED_NEW.test(trimmed)) {
    return {
      type: 'resolution_proposed',
      label: 'Marked as fixed — waiting for resident',
      detail: match?.[1]?.trim(),
      icon: 'clock',
    };
  }

  if (RESOLUTION_UPDATED_OLD.test(trimmed) || RESOLUTION_UPDATED_NEW.test(trimmed)) {
    return {
      type: 'resolution_solution_updated',
      label: 'Changed which reply is the fix',
      icon: 'refresh',
    };
  }

  if (RESOLUTION_CONFIRMED_OLD.test(trimmed) || RESOLUTION_CONFIRMED_NEW.test(trimmed)) {
    return {
      type: 'resolution_confirmed',
      label: 'Resident confirmed — ticket closed',
      icon: 'check',
    };
  }

  if (RESOLUTION_REJECTED.test(trimmed) || RESOLUTION_REJECTED_NEW.test(trimmed)) {
    return {
      type: 'resolution_rejected',
      label: "Resident said it's not fixed yet",
      icon: 'x',
    };
  }

  if (APPEAL_OLD.test(trimmed) || APPEAL_NEW.test(trimmed)) {
    return {
      type: 'appeal_reopened',
      label: 'Resident reopened this ticket',
      icon: 'refresh',
    };
  }

  if (AWAITING_RESIDENT_OLD.test(trimmed) || AWAITING_RESIDENT_NEW.test(trimmed)) {
    return {
      type: 'awaiting_resident',
      label: 'Waiting on resident to reply',
      icon: 'user',
    };
  }

  if (AUTO_RESOLVED.test(trimmed) || AUTO_RESOLVED_NEW.test(trimmed)) {
    return {
      type: 'resolution_auto',
      label: 'Auto-closed — no response in time',
      icon: 'clock',
    };
  }

  if (AUTO_CLOSED.test(trimmed) || AUTO_CLOSED_NEW.test(trimmed)) {
    return {
      type: 'auto_close',
      label: 'Closed — no activity',
      icon: 'clock',
    };
  }

  match = trimmed.match(ABUSIVE_CLOSE);
  if (match) {
    return {
      type: 'abusive_close',
      label: 'Closed by management',
      detail: match[1]?.trim(),
      icon: 'alert',
    };
  }

  if (
    trimmed.startsWith('Status changed to ') ||
    trimmed.startsWith('Category changed to ') ||
    trimmed.startsWith('Priority changed to ') ||
    trimmed === 'Thread reassigned' ||
    trimmed === 'Auto-reassigned after recategorisation'
  ) {
    return {
      type: 'status_change',
      label: humanizeStatusChange(trimmed),
      icon: 'info',
    };
  }

  return { type: 'generic', label: trimmed, icon: 'info' };
}

function humanizeStatusChange(line: string): string {
  if (line.startsWith('Status changed to ')) {
    const status = line.replace('Status changed to ', '');
    return `Status → ${status.toLowerCase().replace(/_/g, ' ')}`;
  }
  if (line.startsWith('Category changed to ')) {
    return 'Recategorized';
  }
  if (line.startsWith('Priority changed to ')) {
    const priority = line.replace('Priority changed to ', '');
    return `Priority → ${priority.toLowerCase()}`;
  }
  if (line === 'Thread reassigned') return 'Reassigned';
  if (line === 'Auto-reassigned after recategorisation') return 'Auto-reassigned';
  return line;
}

/** Parse a SYSTEM message body into one or more displayable timeline events. */
export function parseSystemEvents(body: string): ParsedSystemEvent[] {
  const parts = body
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [{ type: 'generic', label: body.trim() || 'Update', icon: 'info' }];
  }
  return parts.map(parseSingleSystemLine);
}

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
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 1).toUpperCase() || '?';
  const last = parts[parts.length - 1] ?? first;
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

export type MessageAlignment = 'left' | 'right';
export type MessageRole = 'resident' | 'management';

/** Whether the message author is the resident who opened the thread. */
export function messageRole(
  message: ThreadMessageItem,
  opts: { residentId?: string },
): MessageRole {
  const isResidentAuthor = Boolean(opts.residentId && message.author?.id === opts.residentId);
  return isResidentAuthor ? 'resident' : 'management';
}

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
