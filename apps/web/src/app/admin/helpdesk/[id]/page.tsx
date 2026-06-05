'use client';

import { SlaChip } from '@/components/sla-chip';
import { api } from '@/lib/api';
import {
  PRIORITY_TONE,
  STATUS_TONE,
  categoryLabel,
  formatDeadline,
  priorityLabel,
  statusLabel,
} from '@/lib/thread-ui';
import {
  useCloseAbusiveThread,
  useMe,
  usePostThreadMessage,
  useProposeThreadResolution,
  useRequestThreadResident,
  useThread,
  useUpdateThread,
} from '@smartresidence/api-client';
import type { ThreadCategory, ThreadPriority } from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton, Textarea, cn } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  Send,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

const PRIORITIES: ThreadPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const CATEGORIES: ThreadCategory[] = [
  'BILLING',
  'MAINTENANCE',
  'FACILITY',
  'SECURITY',
  'COMPLAINT',
  'SUGGESTION',
  'GOVERNANCE',
  'GENERAL',
];
const selectCls =
  'h-10 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--sr-coral))]';

export default function AdminThreadPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id);
  const post = usePostThreadMessage(api);
  const update = useUpdateThread(api);
  const propose = useProposeThreadResolution(api);
  const requestResident = useRequestThreadResident(api);
  const closeAbusive = useCloseAbusiveThread(api);

  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [composer, setComposer] = React.useState<null | 'propose' | 'request' | 'abusive'>(null);
  const [actionNote, setActionNote] = React.useState('');
  const [selectedSolutionId, setSelectedSolutionId] = React.useState<string | null>(null);

  const meta = (thread.data as { metadata?: Record<string, unknown> } | undefined)?.metadata;
  const duplicateSuggestions = (meta?.duplicateSuggestions ?? []) as Array<{
    id: string;
    subject: string;
  }>;
  const repeatComplainant = Boolean(meta?.repeatComplainant);

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

  async function runPropose() {
    try {
      await propose.mutateAsync({
        id,
        note: actionNote.trim() || undefined,
        messageId: selectedSolutionId ?? undefined,
      });
      toast.success('Marked as fixed — waiting for resident to confirm');
      setComposer(null);
      setActionNote('');
      setSelectedSolutionId(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function runRequest() {
    try {
      await requestResident.mutateAsync({ id, body: actionNote.trim() || undefined });
      toast.success('Sent to resident');
      setComposer(null);
      setActionNote('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reopen() {
    try {
      await update.mutateAsync({ id, status: 'REOPENED' });
      toast.success('Reopened');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function runCloseAbusive() {
    if (actionNote.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }
    try {
      await closeAbusive.mutateAsync({ id, reason: actionNote.trim() });
      toast.success('Ticket closed — resident notified');
      setComposer(null);
      setActionNote('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function exportPdf() {
    try {
      const blob = await api.exportThreadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thread-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (thread.isLoading) return <Skeleton className="h-96" />;
  const t = thread.data;
  if (!t) return <div className="sr-muted text-sm">Thread not found.</div>;

  const pending = t.status === 'PENDING_RESIDENT_CONFIRMATION';
  const finished = t.status === 'RESOLVED' || t.status === 'CLOSED';
  const awaitingResident = t.status === 'AWAITING_RESIDENT';
  const mgmtMessages = t.messages.filter(
    (m) => m.kind === 'MESSAGE' && m.author?.id !== t.createdBy?.id,
  );

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/helpdesk"
        className="inline-flex items-center gap-1 text-sm sr-muted w-fit"
      >
        <ArrowLeft className="size-4" /> Helpdesk
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{t.subject}</h2>
                {(t.reopenCount ?? 0) > 0 ? (
                  <Badge tone="warning">Reopened ×{t.reopenCount}</Badge>
                ) : null}
                {repeatComplainant ? (
                  <Badge tone="danger">
                    <AlertTriangle className="size-3" /> Repeat complainant
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs sr-muted mt-1">
                {t.unit?.identifier ? `Unit ${t.unit.identifier} · ` : ''}
                {t.createdBy?.name ?? 'Resident'} · {categoryLabel(t.category)}
              </div>
            </div>
            <SlaChip
              slaState={t.slaState}
              firstResponseDueAt={t.firstResponseDueAt}
              resolutionDueAt={t.resolutionDueAt}
            />
          </header>

          {duplicateSuggestions.length > 0 ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
              <div className="font-medium flex items-center gap-1">
                <Copy className="size-4" /> Possible duplicates
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {duplicateSuggestions.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/admin/helpdesk/${d.id}`}
                      className="text-coral-600 hover:underline"
                    >
                      {d.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pending ? (
            <div className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-sky-600 shrink-0" />
              <span>
                Waiting for resident to confirm it&apos;s fixed. Tap another message below to change
                which reply counts as the fix.
              </span>
            </div>
          ) : null}

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
              const isProposed = t.resolutionProposedMessageId === m.id;
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line relative',
                      mine
                        ? 'bg-coral-500 text-white rounded-br-sm'
                        : 'bg-[rgb(var(--sr-border))]/40 rounded-bl-sm',
                      isProposed && 'ring-2 ring-sky-500',
                    )}
                  >
                    {isProposed ? (
                      <div className="text-[10px] font-semibold mb-1 opacity-80">
                        ✓ Suggested fix
                      </div>
                    ) : null}
                    {m.body}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-[11px] sr-muted">
                      {m.author?.name ?? 'Resident'} · {new Date(m.createdAt).toLocaleString()}
                    </span>
                    {!mine && m.kind === 'MESSAGE' && (composer === 'propose' || pending) ? (
                      <button
                        type="button"
                        className="text-[11px] text-sky-600 hover:underline"
                        onClick={() => setSelectedSolutionId(m.id)}
                      >
                        {selectedSolutionId === m.id || isProposed ? 'Selected' : 'Use as the fix'}
                      </button>
                    ) : null}
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

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={PRIORITY_TONE[t.priority]}>{priorityLabel(t.priority)}</Badge>
              <Badge tone={STATUS_TONE[t.status]}>{statusLabel(t.status)}</Badge>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Priority</span>
              <select
                aria-label="Thread priority"
                className={selectCls}
                value={t.priority}
                onChange={async (e) => {
                  try {
                    await update.mutateAsync({ id, priority: e.target.value as ThreadPriority });
                    toast.success('Priority updated');
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Category</span>
              <select
                aria-label="Thread category"
                className={selectCls}
                value={t.category}
                onChange={async (e) => {
                  try {
                    await update.mutateAsync({ id, category: e.target.value as ThreadCategory });
                    toast.success('Category updated — may auto-reassign');
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Assignee</span>
              <div className="text-sm sr-muted">{t.assignedTo?.name ?? 'No one assigned yet'}</div>
              {myId && t.assignedTo?.id !== myId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await update.mutateAsync({ id, assignedToUserId: myId });
                      toast.success('You took this ticket');
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  <UserCheck className="size-4" />
                  Take this ticket
                </Button>
              ) : null}
            </div>

            <div className="border-t border-[rgb(var(--sr-border))] pt-3 flex flex-col gap-2">
              <span className="text-sm font-medium">Wrap up</span>
              {awaitingResident ? (
                <p className="text-xs text-amber-600">
                  Waiting for the resident to reply — you can mark as fixed once they&apos;ve
                  responded.
                </p>
              ) : null}
              {pending ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs sr-muted">
                    Change which reply is the fix, or wait for the resident to confirm.
                  </p>
                  <Button
                    size="sm"
                    onClick={runPropose}
                    disabled={propose.isPending || !selectedSolutionId}
                  >
                    Change which reply is the fix
                  </Button>
                </div>
              ) : finished ? (
                <Button variant="secondary" size="sm" onClick={reopen} disabled={update.isPending}>
                  <RotateCcw className="size-4" />
                  Reopen
                </Button>
              ) : composer === 'propose' ? (
                <div className="flex flex-col gap-2">
                  {mgmtMessages.length > 0 ? (
                    <p className="text-xs sr-muted">
                      Tap &ldquo;Use as the fix&rdquo; on a management message, or mark as fixed
                      without picking one.
                    </p>
                  ) : null}
                  <Textarea
                    rows={2}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Optional note for the resident…"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={runPropose} disabled={propose.isPending}>
                      <CheckCircle2 className="size-4" />
                      Mark as fixed
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setComposer(null);
                        setActionNote('');
                        setSelectedSolutionId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs sr-muted">
                    Tell the resident you believe this is solved. They&apos;ll confirm before we
                    close it.
                  </p>
                </div>
              ) : composer === 'request' ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    rows={2}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="What do you need from the resident?"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={runRequest} disabled={requestResident.isPending}>
                      <UserPlus className="size-4" />
                      Ask resident for info
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setComposer(null);
                        setActionNote('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs sr-muted">
                    Need something from them? The ticket pauses until they reply.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <Button
                      size="sm"
                      onClick={() => setComposer('propose')}
                      disabled={awaitingResident}
                    >
                      <CheckCircle2 className="size-4" />
                      Mark as fixed
                    </Button>
                    <p className="text-xs sr-muted mt-1">
                      Tell the resident you believe this is solved. They&apos;ll confirm before we
                      close it.
                    </p>
                  </div>
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => setComposer('request')}>
                      <UserPlus className="size-4" />
                      Ask resident for info
                    </Button>
                    <p className="text-xs sr-muted mt-1">
                      Need something from them? Pauses until they reply.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[11px] sr-muted">
                Residents must confirm before we close a ticket. Timing is set in{' '}
                <Link href="/admin/settings/helpdesk" className="text-coral-600 hover:underline">
                  SLA settings
                </Link>
                .
              </p>
            </div>

            {!finished ? (
              <div className="border-t border-[rgb(var(--sr-border))] pt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-rose-600">Close as misuse</span>
                {composer === 'abusive' ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      rows={3}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Reason shown to the resident…"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={runCloseAbusive}
                        disabled={closeAbusive.isPending}
                      >
                        <Ban className="size-4" />
                        Close and notify resident
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setComposer(null);
                          setActionNote('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs sr-muted">
                      Spam or abuse. The resident will be notified.
                    </p>
                  </div>
                ) : (
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => setComposer('abusive')}>
                      <Ban className="size-4" />
                      Close as misuse
                    </Button>
                    <p className="text-xs sr-muted mt-1">
                      Spam or abuse. The resident will be notified.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="border-t border-[rgb(var(--sr-border))] pt-3">
              <Button size="sm" variant="secondary" onClick={exportPdf}>
                <Download className="size-4" />
                Download conversation (PDF)
              </Button>
            </div>

            <div className="border-t border-[rgb(var(--sr-border))] pt-3 text-xs sr-muted flex flex-col gap-1">
              {t.firstResponseDueAt ? (
                <div>
                  {formatDeadline(t.firstResponseDueAt, 'firstResponse')} ·{' '}
                  {new Date(t.firstResponseDueAt).toLocaleString()}
                </div>
              ) : null}
              {t.resolutionDueAt ? (
                <div>
                  {formatDeadline(t.resolutionDueAt, 'resolution')} ·{' '}
                  {new Date(t.resolutionDueAt).toLocaleString()}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
