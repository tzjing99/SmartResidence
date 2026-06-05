'use client';

import { api } from '@/lib/api';
import { PRIORITY_TONE, SLA_TONE, STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import {
  useMe,
  usePostThreadMessage,
  useThread,
  useUpdateThread,
} from '@smartresidence/api-client';
import type { ThreadPriority, ThreadStatus } from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton, Textarea, cn } from '@smartresidence/ui-web';
import { ArrowLeft, Send, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

const PRIORITIES: ThreadPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUSES: ThreadStatus[] = [
  'OPEN',
  'AWAITING_RESIDENT',
  'AWAITING_MANAGEMENT',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];
const selectCls =
  'h-10 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm';

export default function AdminThreadPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id);
  const post = usePostThreadMessage(api);
  const update = useUpdateThread(api);
  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await post.mutateAsync({ id, body: body.trim(), internalNote: internal });
      setBody('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function patch(data: {
    priority?: ThreadPriority;
    status?: ThreadStatus;
    assignedToUserId?: string;
  }) {
    try {
      await update.mutateAsync({ id, ...data });
      toast.success('Updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (thread.isLoading) return <Skeleton className="h-96" />;
  const t = thread.data;
  if (!t) return <div className="sr-muted text-sm">Thread not found.</div>;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/helpdesk"
        className="inline-flex items-center gap-1 text-sm sr-muted w-fit"
      >
        <ArrowLeft className="size-4" /> Helpdesk
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t.subject}</h2>
              <div className="text-xs sr-muted mt-1">
                {t.unit?.identifier ? `Unit ${t.unit.identifier} · ` : ''}
                {t.createdBy?.name ?? 'Resident'} · {prettyLabel(t.category)}
              </div>
            </div>
            {t.slaState !== 'NONE' ? (
              <Badge tone={SLA_TONE[t.slaState]}>SLA {prettyLabel(t.slaState)}</Badge>
            ) : null}
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
              if (m.kind === 'INTERNAL_NOTE') {
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm"
                  >
                    <div className="text-[11px] font-medium text-amber-600 mb-1">
                      Internal note · {m.author?.name ?? 'Staff'}
                    </div>
                    <div className="whitespace-pre-line">{m.body}</div>
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
                    {m.author?.name ?? 'Resident'} · {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </Card>

          <form onSubmit={send} className="flex flex-col gap-3">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                internal
                  ? 'Add an internal note (residents can\u2019t see this)…'
                  : 'Reply to the resident…'
              }
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm sr-muted">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Internal note
              </label>
              <Button type="submit" disabled={post.isPending || !body.trim()}>
                <Send className="size-4" />
                {post.isPending ? 'Sending…' : internal ? 'Add note' : 'Reply'}
              </Button>
            </div>
          </form>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge tone={PRIORITY_TONE[t.priority]}>{prettyLabel(t.priority)}</Badge>
              <Badge tone={STATUS_TONE[t.status]}>{prettyLabel(t.status)}</Badge>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Priority</span>
              <select
                className={selectCls}
                value={t.priority}
                onChange={(e) => patch({ priority: e.target.value as ThreadPriority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {prettyLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Status</span>
              <select
                className={selectCls}
                value={t.status}
                onChange={(e) => patch({ status: e.target.value as ThreadStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {prettyLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Assignee</span>
              <div className="text-sm sr-muted">{t.assignedTo?.name ?? 'Unassigned'}</div>
              {myId && t.assignedTo?.id !== myId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => patch({ assignedToUserId: myId })}
                >
                  <UserCheck className="size-4" />
                  Assign to me
                </Button>
              ) : null}
            </div>

            <div className="border-t border-[rgb(var(--sr-border))] pt-3 text-xs sr-muted">
              {t.resolutionDueAt ? (
                <div>Resolution due {new Date(t.resolutionDueAt).toLocaleString()}</div>
              ) : null}
              {t.firstResponseDueAt ? (
                <div>First response due {new Date(t.firstResponseDueAt).toLocaleString()}</div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
