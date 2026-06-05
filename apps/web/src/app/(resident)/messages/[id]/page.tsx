'use client';

import { api } from '@/lib/api';
import { PRIORITY_TONE, SLA_TONE, STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import { useMe, usePostThreadMessage, useThread } from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton, Textarea, cn } from '@smartresidence/ui-web';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

export default function ResidentThreadPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id);
  const post = usePostThreadMessage(api);
  const [body, setBody] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message count
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.data?.messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await post.mutateAsync({ id, body: body.trim() });
      setBody('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (thread.isLoading) return <Skeleton className="h-96" />;
  const t = thread.data;
  if (!t) return <div className="sr-muted text-sm">Conversation not found.</div>;

  const closed = t.status === 'CLOSED';

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link href="/messages" className="inline-flex items-center gap-1 text-sm sr-muted w-fit">
        <ArrowLeft className="size-4" /> All messages
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.subject}</h2>
          <div className="text-xs sr-muted mt-1">{prettyLabel(t.category)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge tone={PRIORITY_TONE[t.priority]}>{prettyLabel(t.priority)}</Badge>
          <Badge tone={STATUS_TONE[t.status]}>{prettyLabel(t.status)}</Badge>
          {t.slaState !== 'NONE' ? (
            <Badge tone={SLA_TONE[t.slaState]}>SLA {prettyLabel(t.slaState)}</Badge>
          ) : null}
        </div>
      </header>

      <Card className="flex flex-col gap-4">
        {t.messages.map((m) => {
          if (m.kind === 'SYSTEM') {
            return (
              <div key={m.id} className="text-center text-xs sr-muted py-1">
                {m.body} · {new Date(m.createdAt).toLocaleString()}
              </div>
            );
          }
          const mine = m.author?.id === myId;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line',
                  mine
                    ? 'bg-coral-500 text-white rounded-br-sm'
                    : 'bg-[rgb(var(--sr-border))]/40 rounded-bl-sm',
                )}
              >
                {m.body}
              </div>
              <div className="text-[11px] sr-muted mt-1 px-1">
                {mine ? 'You' : (m.author?.name ?? 'Management')} ·{' '}
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </Card>

      {closed ? (
        <p className="text-sm sr-muted text-center">This conversation is closed.</p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-3">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={post.isPending || !body.trim()}>
              <Send className="size-4" />
              {post.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
