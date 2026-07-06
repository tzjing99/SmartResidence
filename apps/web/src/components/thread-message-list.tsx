'use client';

import { AuthImage } from '@/components/auth-image';
import {
  type MessageRole,
  type SystemEventIcon,
  authorInitials,
  displayAuthorName,
  formatMessageTime,
  messageAlignment,
  messageRole,
  parseSystemEvents,
} from '@/lib/thread-messages';
import type { ThreadMessageItem } from '@smartresidence/api-client';
import { cn, iosSpring, listStaggerDelay } from '@smartresidence/ui-web';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, Info, RefreshCw, User, XCircle } from 'lucide-react';
import * as React from 'react';

function MessageEnter({
  id,
  index,
  knownIds,
  children,
}: {
  id: string;
  index: number;
  knownIds: React.MutableRefObject<Set<string>>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const isKnown = knownIds.current.has(id);

  React.useLayoutEffect(() => {
    knownIds.current.add(id);
  }, [id, knownIds]);

  if (reduceMotion) {
    return <div data-message-id={id}>{children}</div>;
  }

  return (
    <motion.div
      data-message-id={id}
      initial={isKnown ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...iosSpring.snappy,
        delay: isKnown ? 0 : listStaggerDelay(index),
      }}
    >
      {children}
    </motion.div>
  );
}

const EVENT_ICONS: Record<SystemEventIcon, React.ComponentType<{ className?: string }>> = {
  check: CheckCircle2,
  clock: Clock,
  x: XCircle,
  refresh: RefreshCw,
  user: User,
  alert: AlertTriangle,
  info: Info,
};

function avatarClasses(role: MessageRole, variant: 'admin' | 'resident'): string {
  if (role === 'resident') {
    return 'bg-stone-200/80 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200';
  }
  return variant === 'admin'
    ? 'bg-coral-500/15 text-coral-700 dark:text-coral-300'
    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
}

function bubbleClasses(
  role: MessageRole,
  align: 'left' | 'right',
  variant: 'admin' | 'resident',
  highlightProposed: boolean,
): string {
  if (highlightProposed) {
    return 'message-bubble-proposed';
  }
  if (role === 'resident') {
    return cn('message-bubble-resident', align === 'left' ? 'rounded-bl-md' : 'rounded-br-md');
  }
  if (variant === 'admin') {
    return cn('message-bubble-mgmt-coral', align === 'right' ? 'rounded-br-md' : 'rounded-bl-md');
  }
  return cn('message-bubble-mgmt-sky', 'rounded-bl-md');
}

function proposedLabelClasses(
  role: MessageRole,
  variant: 'admin' | 'resident',
  highlightProposed: boolean,
): string {
  if (highlightProposed) return 'text-sky-700 dark:text-sky-400';
  if (role === 'management' && variant === 'admin') return 'text-white/90';
  return 'text-sky-700 dark:text-sky-400';
}

function SystemEventPill({
  label,
  detail,
  icon,
  createdAt,
}: {
  label: string;
  detail?: string;
  icon: SystemEventIcon;
  createdAt: string;
}) {
  const Icon = EVENT_ICONS[icon];
  return (
    <div className="flex justify-center py-2">
      <output className="inline-flex flex-col items-center gap-1 max-w-[min(100%,24rem)]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-100/90 dark:bg-stone-800/50 px-3 h-6 text-[10px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          <Icon className="size-3 shrink-0 opacity-60" aria-hidden />
          <span className="leading-none">{label}</span>
          <span className="opacity-40 select-none" aria-hidden>
            ·
          </span>
          <time dateTime={createdAt} className="opacity-70 tabular-nums leading-none normal-case">
            {formatMessageTime(createdAt)}
          </time>
        </div>
        {detail ? (
          <p className="text-[11px] sr-muted text-center px-4 leading-snug">{detail}</p>
        ) : null}
      </output>
    </div>
  );
}

function InternalNoteCard({ message }: { message: ThreadMessageItem }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/50 bg-amber-50/80 dark:bg-amber-950/25 dark:border-amber-600/30 pl-4 pr-3.5 py-2.5 text-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-amber-400">
      <div className="text-meta-row font-medium text-amber-800 dark:text-amber-400 mb-1.5">
        <span>Internal note</span>
        <span className="text-meta-sep">·</span>
        <span>{message.author?.name ?? 'Staff'}</span>
        <span className="text-meta-sep">·</span>
        <time dateTime={message.createdAt} className="font-normal opacity-80 tabular-nums">
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      <div className="sr-body whitespace-pre-line leading-relaxed">{message.body}</div>
    </div>
  );
}

function MessageBubble({
  message,
  align,
  authorName,
  role,
  variant,
  isProposed,
  highlightProposed,
  onSelectAsFix,
  selectedAsFix,
  showFixAction,
}: {
  message: ThreadMessageItem;
  align: 'left' | 'right';
  authorName: string;
  role: MessageRole;
  variant: 'admin' | 'resident';
  isProposed: boolean;
  highlightProposed: boolean;
  onSelectAsFix?: (id: string) => void;
  selectedAsFix?: boolean;
  showFixAction?: boolean;
}) {
  const initials = authorInitials(authorName === 'You' ? 'You' : message.author?.name);
  const isRight = align === 'right';

  return (
    <div
      className={cn('flex items-start gap-3', isRight ? 'flex-row-reverse' : 'flex-row')}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'size-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold',
          avatarClasses(role, variant),
        )}
        aria-hidden
      >
        {initials}
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1 max-w-[min(85%,28rem)]',
          isRight ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn('text-meta-row px-0.5 w-full', isRight && 'flex-row-reverse justify-end')}
        >
          <span className="font-semibold text-[rgb(var(--sr-fg))]/90 leading-none">
            {authorName}
          </span>
          <span className="text-meta-sep">·</span>
          <time dateTime={message.createdAt} className="tabular-nums leading-none">
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <div
          className={cn(
            'relative w-full rounded-2xl px-4 py-3 sr-body whitespace-pre-line leading-relaxed text-left',
            bubbleClasses(role, align, variant, highlightProposed),
          )}
        >
          {isProposed ? (
            <div
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide mb-1',
                proposedLabelClasses(role, variant, highlightProposed),
              )}
            >
              Suggested fix
            </div>
          ) : null}
          {message.body}
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {message.attachments
                .filter((a) => a.mimeType.startsWith('image/'))
                .map((a) => (
                  <AuthImage
                    key={a.id}
                    attachmentId={a.id}
                    variant="thumb"
                    alt=""
                    className="aspect-square rounded-lg border border-black/5"
                  />
                ))}
            </div>
          ) : null}
        </div>
        {showFixAction && onSelectAsFix ? (
          <button
            type="button"
            className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline px-0.5"
            onClick={() => onSelectAsFix(message.id)}
            aria-label={selectedAsFix || isProposed ? 'Selected as fix' : 'Use as the fix'}
            aria-pressed={selectedAsFix || isProposed}
          >
            {selectedAsFix || isProposed ? 'Selected as fix' : 'Use as the fix'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface ThreadMessageListProps {
  messages: ThreadMessageItem[];
  variant: 'admin' | 'resident';
  viewerId?: string;
  residentId?: string;
  resolutionProposedMessageId?: string | null;
  /** When true, proposed solution messages get a highlighted card style. */
  highlightProposedSolution?: boolean;
  showProposeActions?: boolean;
  selectedProposedMessageId?: string | null;
  onSelectProposedMessage?: (messageId: string) => void;
  bottomRef?: React.Ref<HTMLDivElement>;
  className?: string;
}

export function ThreadMessageList({
  messages,
  variant,
  viewerId,
  residentId,
  resolutionProposedMessageId,
  highlightProposedSolution = false,
  showProposeActions = false,
  selectedProposedMessageId,
  onSelectProposedMessage,
  bottomRef,
  className,
}: ThreadMessageListProps) {
  const knownIds = React.useRef<Set<string>>(new Set());

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {messages.map((m, index) => {
        if (m.kind === 'SYSTEM') {
          const events = parseSystemEvents(m.body);
          const proposedMsgId = resolutionProposedMessageId;
          return (
            <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
              <div className="flex flex-col gap-1">
                {events.map((event, i) => {
                  const hideDetail =
                    event.type === 'resolution_proposed' &&
                    Boolean(proposedMsgId) &&
                    Boolean(event.detail);
                  return (
                    <SystemEventPill
                      key={`${m.id}-${i}`}
                      label={event.label}
                      detail={hideDetail ? undefined : event.detail}
                      icon={event.icon}
                      createdAt={m.createdAt}
                    />
                  );
                })}
              </div>
            </MessageEnter>
          );
        }

        if (m.kind === 'INTERNAL_NOTE') {
          return (
            <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
              <InternalNoteCard message={m} />
            </MessageEnter>
          );
        }

        const align = messageAlignment(m, { variant, viewerId, residentId });
        const role = messageRole(m, { residentId });
        const isProposed = resolutionProposedMessageId === m.id;
        const authorName = displayAuthorName(m, { variant, viewerId, residentId });

        return (
          <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
            <MessageBubble
              message={m}
              align={align}
              authorName={authorName}
              role={role}
              variant={variant}
              isProposed={isProposed}
              highlightProposed={isProposed && highlightProposedSolution}
              showFixAction={
                showProposeActions &&
                m.kind === 'MESSAGE' &&
                Boolean(residentId && m.author?.id !== residentId)
              }
              selectedAsFix={selectedProposedMessageId === m.id}
              onSelectAsFix={onSelectProposedMessage}
            />
          </MessageEnter>
        );
      })}
      {bottomRef ? <div ref={bottomRef} aria-hidden /> : null}
    </div>
  );
}
