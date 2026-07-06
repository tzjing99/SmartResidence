'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { PRIORITY_TONE, STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import { useThreads } from '@smartresidence/api-client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  iosSpring,
  listStaggerDelay,
} from '@smartresidence/ui-web';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';

const SKELETON_KEYS = ['s1', 's2', 's3'];

export default function MessagesPage() {
  const tr = useT();
  const reduceMotion = useReducedMotion();
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
        <ul className="flex flex-col gap-3">
          {SKELETON_KEYS.map((key) => (
            <li key={key}>
              <Skeleton className="h-20 w-full rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : (threads.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Start a conversation with management — every reply is tracked here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.data?.items.map((thread, index) => (
            <motion.li
              key={thread.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { ...iosSpring.default, delay: listStaggerDelay(index) }
              }
            >
              <Link href={`/messages/${thread.id}`}>
                <Card
                  interactive
                  className="transition-[box-shadow,border-color] duration-150 hover:shadow-md hover:border-[rgb(var(--sr-coral))]/25"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate leading-tight">{thread.subject}</div>
                      <div className="text-meta-row mt-0.5">
                        <span>{prettyLabel(tr, thread.category)}</span>
                        <span className="text-meta-sep">·</span>
                        <span>{thread._count?.messages ?? 0} messages</span>
                        <span className="text-meta-sep">·</span>
                        <span>updated {new Date(thread.lastMessageAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={PRIORITY_TONE[thread.priority]}>
                        {prettyLabel(tr, thread.priority)}
                      </Badge>
                      <Badge tone={STATUS_TONE[thread.status]}>
                        {prettyLabel(tr, thread.status)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
