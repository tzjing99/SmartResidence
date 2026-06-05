'use client';

import { SlaChip } from '@/components/sla-chip';
import { ThreadMessageList } from '@/components/thread-message-list';
import { api } from '@/lib/api';
import { STATUS_TONE, categoryLabel, priorityLabel, statusLabel } from '@/lib/thread-ui';
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
import { Badge, Button, Card, Skeleton, Textarea } from '@smartresidence/ui-web';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  MoreHorizontal,
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
  'h-9 w-full rounded-lg border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--sr-coral))]';

function ActionHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] sr-muted leading-snug">{children}</p>;
}

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
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);

  const meta = (thread.data as { metadata?: Record<string, unknown> } | undefined)?.metadata;
  const duplicateSuggestions = (meta?.duplicateSuggestions ?? []) as Array<{
    id: string;
    subject: string;
  }>;
  const repeatComplainant = Boolean(meta?.repeatComplainant);

  React.useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

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
    setMoreOpen(false);
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

  function resetComposer() {
    setComposer(null);
    setActionNote('');
    setSelectedSolutionId(null);
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
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/helpdesk"
        className="inline-flex items-center gap-1 text-sm sr-muted w-fit"
      >
        <ArrowLeft className="size-4" /> Helpdesk
      </Link>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Thread column — primary focus */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <header className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight leading-snug">{t.subject}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[t.status]}>{statusLabel(t.status)}</Badge>
              <SlaChip
                slaState={t.slaState}
                firstResponseDueAt={t.firstResponseDueAt}
                resolutionDueAt={t.resolutionDueAt}
              />
              {(t.reopenCount ?? 0) > 0 ? (
                <Badge tone="warning">Reopened ×{t.reopenCount}</Badge>
              ) : null}
              {repeatComplainant ? (
                <Badge tone="danger">
                  <AlertTriangle className="size-3" /> Repeat complainant
                </Badge>
              ) : null}
            </div>
            <p className="text-xs sr-muted">
              {t.unit?.identifier ? `Unit ${t.unit.identifier} · ` : ''}
              {t.createdBy?.name ?? 'Resident'} · {categoryLabel(t.category)}
            </p>
          </header>

          {duplicateSuggestions.length > 0 ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm">
              <div className="font-medium flex items-center gap-1.5 text-sm">
                <Copy className="size-3.5 shrink-0" /> Possible duplicates
              </div>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {duplicateSuggestions.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/admin/helpdesk/${d.id}`}
                      className="text-coral-600 hover:underline text-sm"
                    >
                      {d.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pending ? (
            <div
              className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm flex items-center gap-2"
              title="Tap a management message below to change which reply counts as the fix."
            >
              <CheckCircle2 className="size-4 text-sky-600 shrink-0" />
              <span>Waiting for resident to confirm the fix.</span>
            </div>
          ) : null}

          <Card className="p-4">
            <ThreadMessageList
              messages={t.messages}
              variant="admin"
              viewerId={myId}
              residentId={t.createdBy?.id}
              resolutionProposedMessageId={t.resolutionProposedMessageId}
              highlightProposedSolution={pending}
              showProposeActions={composer === 'propose' || pending}
              selectedProposedMessageId={selectedSolutionId}
              onSelectProposedMessage={setSelectedSolutionId}
            />
          </Card>

          <form onSubmit={send} className="flex flex-col gap-2">
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
            <div className="flex items-center justify-between gap-3">
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

        {/* Sidebar — metadata + actions */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-sm font-medium">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] sr-muted uppercase tracking-wide">Priority</span>
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
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] sr-muted uppercase tracking-wide">Category</span>
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
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="min-w-0">
                <span className="text-[11px] sr-muted uppercase tracking-wide">Assignee</span>
                <p className="text-sm truncate">{t.assignedTo?.name ?? 'Unassigned'}</p>
              </div>
              {myId && t.assignedTo?.id !== myId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
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
                  Take
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h3 className="text-sm font-medium">Wrap up</h3>

            {awaitingResident ? (
              <ActionHint>
                Waiting for the resident to reply before you can mark as fixed.
              </ActionHint>
            ) : null}

            {pending ? (
              <div className="flex flex-col gap-2">
                <ActionHint>Change which reply is the fix, or wait for confirmation.</ActionHint>
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
                  <ActionHint>Tap &ldquo;Use as the fix&rdquo; on a message, or skip.</ActionHint>
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
                  <Button size="sm" variant="ghost" onClick={resetComposer}>
                    Cancel
                  </Button>
                </div>
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
                  <Button size="sm" variant="ghost" onClick={resetComposer}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => setComposer('propose')}
                  disabled={awaitingResident}
                  title="Tell the resident you believe this is solved. They'll confirm before we close it."
                >
                  <CheckCircle2 className="size-4" />
                  Mark as fixed
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setComposer('request')}
                  title="Need something from them? The ticket pauses until they reply."
                >
                  <UserPlus className="size-4" />
                  Ask resident for info
                </Button>
              </div>
            )}
          </Card>

          {composer === 'abusive' ? (
            <Card className="p-4 flex flex-col gap-2 border-red-200/60">
              <h3 className="text-sm font-medium text-rose-600">Close as misuse</h3>
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
                  Close and notify
                </Button>
                <Button size="sm" variant="ghost" onClick={resetComposer}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : null}

          <div ref={moreRef} className="relative flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="size-4" />
              More
            </Button>
            {moreOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 min-w-[12rem] rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] py-1 shadow-lg"
              >
                {!finished ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left text-rose-600"
                    onClick={() => {
                      setMoreOpen(false);
                      setComposer('abusive');
                    }}
                  >
                    <Ban className="size-4 shrink-0" />
                    Close as misuse
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left"
                  onClick={exportPdf}
                >
                  <Download className="size-4 shrink-0" />
                  Download PDF
                </button>
                <Link
                  href="/admin/settings/helpdesk"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left sr-muted"
                  onClick={() => setMoreOpen(false)}
                >
                  SLA settings
                </Link>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
