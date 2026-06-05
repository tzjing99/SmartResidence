'use client';

import {
  type SystemEventIcon,
  authorInitials,
  displayAuthorName,
  formatMessageTime,
  messageAlignment,
  parseSystemEvents,
} from '@/lib/thread-messages';
import type { ThreadMessageItem } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import { AlertTriangle, CheckCircle2, Clock, Info, RefreshCw, User, XCircle } from 'lucide-react';
import type * as React from 'react';

const EVENT_ICONS: Record<SystemEventIcon, React.ComponentType<{ className?: string }>> = {
  check: CheckCircle2,
  clock: Clock,
  x: XCircle,
  refresh: RefreshCw,
  user: User,
  alert: AlertTriangle,
  info: Info,
};

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
    <div className="flex justify-center py-1.5">
      <output className="inline-flex flex-col items-center gap-1 max-w-[min(100%,24rem)]">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--sr-border))]/50 bg-[rgb(var(--sr-border))]/15 px-3 h-6 text-[11px] leading-none text-[rgb(var(--sr-muted))]">
          <Icon className="size-3 shrink-0 opacity-70" aria-hidden />
          <span className="font-medium leading-none">{label}</span>
          <span className="text-meta-sep" aria-hidden>
            ·
          </span>
          <time dateTime={createdAt} className="opacity-70 tabular-nums leading-none">
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
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-sm">
      <div className="text-meta-row font-medium text-amber-700 dark:text-amber-500 mb-1.5">
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
  isProposed,
  highlightProposed,
  onSelectAsFix,
  selectedAsFix,
  showFixAction,
}: {
  message: ThreadMessageItem;
  align: 'left' | 'right';
  authorName: string;
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
      className={cn(
        'flex items-start gap-2.5',
        isRight ? 'flex-row-reverse' : 'flex-row',
      )}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'size-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold',
          isRight
            ? 'bg-coral-500/15 text-coral-700 dark:text-coral-300'
            : 'bg-[rgb(var(--sr-border))]/50 text-[rgb(var(--sr-muted))]',
        )}
        aria-hidden
      >
        {initials}
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-0.5 max-w-[min(85%,28rem)]',
          isRight ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'text-meta-row px-0.5 w-full',
            isRight && 'flex-row-reverse justify-end',
          )}
        >
          <span className="font-medium text-[rgb(var(--sr-fg))]/80 leading-none">{authorName}</span>
          <span className="text-meta-sep">·</span>
          <time dateTime={message.createdAt} className="tabular-nums leading-none">
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <div
          className={cn(
            'relative w-full rounded-2xl px-3.5 py-2.5 sr-body whitespace-pre-line leading-relaxed text-left',
            isRight
              ? 'bg-coral-500 text-white rounded-br-md'
              : 'bg-[rgb(var(--sr-border))]/35 rounded-bl-md',
            highlightProposed &&
              'ring-2 ring-sky-500/80 shadow-sm bg-sky-50/80 dark:bg-sky-950/30 text-[rgb(var(--sr-fg))]',
          )}
        >
          {isProposed ? (
            <div
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide mb-1',
                isRight && !highlightProposed ? 'text-white/85' : 'text-sky-700 dark:text-sky-400',
              )}
            >
              Suggested fix
            </div>
          ) : null}
          {message.body}
        </div>
        {showFixAction && onSelectAsFix ? (
          <button
            type="button"
            className="text-[11px] text-sky-600 hover:underline px-0.5"
            onClick={() => onSelectAsFix(message.id)}
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
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {messages.map((m) => {
        if (m.kind === 'SYSTEM') {
          const events = parseSystemEvents(m.body);
          const proposedMsgId = resolutionProposedMessageId;
          return (
            <div key={m.id} className="flex flex-col gap-1">
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
          );
        }

        if (m.kind === 'INTERNAL_NOTE') {
          return <InternalNoteCard key={m.id} message={m} />;
        }

        const align = messageAlignment(m, { variant, viewerId, residentId });
        const isProposed = resolutionProposedMessageId === m.id;
        const authorName = displayAuthorName(m, { variant, viewerId, residentId });

        return (
          <MessageBubble
            key={m.id}
            message={m}
            align={align}
            authorName={authorName}
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
        );
      })}
      {bottomRef ? <div ref={bottomRef} aria-hidden /> : null}
    </div>
  );
}
