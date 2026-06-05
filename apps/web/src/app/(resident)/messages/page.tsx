'use client';

import { api } from '@/lib/api';
import { PRIORITY_TONE, STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import { useThreads } from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';

const SKELETON_KEYS = ['s1', 's2', 's3'];

export default function MessagesPage() {
  const threads = useThreads(api);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="sr-section-title">Messages</h2>
          <p className="sr-muted">Ask management anything — every reply is tracked.</p>
        </div>
        <Link href="/messages/new">
          <Button>
            <MessageSquarePlus className="size-4" />
            New message
          </Button>
        </Link>
      </header>

      {threads.isLoading ? (
        <div className="flex flex-col gap-3">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-24" />
          ))}
        </div>
      ) : (threads.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start a thread and management will respond within their SLA."
          action={
            <Link href="/messages/new">
              <Button>Start a conversation</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.data?.items.map((t) => (
            <li key={t.id}>
              <Link href={`/messages/${t.id}`}>
                <Card className="transition-colors hover:border-[rgb(var(--sr-coral))]/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.subject}</div>
                      <div className="text-xs sr-muted mt-0.5">
                        {prettyLabel(t.category)} · {t._count?.messages ?? 0} messages · updated{' '}
                        {new Date(t.lastMessageAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Badge tone={PRIORITY_TONE[t.priority]}>{prettyLabel(t.priority)}</Badge>
                      <Badge tone={STATUS_TONE[t.status]}>{prettyLabel(t.status)}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
