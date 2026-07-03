'use client';

import { SlaChip } from '@/components/sla-chip';
import { ThreadMessageList } from '@/components/thread-message-list';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { STATUS_TONE, categoryLabel, priorityLabel, statusLabel } from '@/lib/thread-ui';
import { toast } from '@/lib/toast';
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
import { useThreadRoom } from '@smartresidence/api-client/realtime';
import { Badge, Button, Card, Label, Skeleton, Textarea } from '@smartresidence/ui-web';
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
const selectCls = 'sr-select-sm';

function ActionHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] sr-muted leading-snug">{children}</p>;
}

export default function AdminThreadPage() {
  const tr = useT();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id);
  useThreadRoom(id);
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
  const replyBodyId = React.useId();
  const actionNoteId = React.useId();
  const abusiveReasonId = React.useId();

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
    const text = body.trim();
    const noteInternal = internal;
    setBody('');
    try {
      await post.mutateAsync({ id, body: text, internalNote: noteInternal });
    } catch (err) {
      setBody(text);
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
      toast.success(tr('helpdesk.detail.markedFixedToast'));
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
      toast.success(tr('helpdesk.detail.sentToResidentToast'));
      setComposer(null);
      setActionNote('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reopen() {
    try {
      await update.mutateAsync({ id, status: 'REOPENED' });
      toast.success(tr('helpdesk.detail.reopenedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function runCloseAbusive() {
    if (actionNote.trim().length < 10) {
      toast.error(tr('helpdesk.detail.abuseReasonValidation'));
      return;
    }
    try {
      await closeAbusive.mutateAsync({ id, reason: actionNote.trim() });
      toast.success(tr('helpdesk.detail.closedAbuseToast'));
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
  if (!t) return <div className="sr-muted text-sm">{tr('helpdesk.detail.notFound')}</div>;

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
        <ArrowLeft className="size-4" /> {tr('helpdesk.detail.backLink')}
      </Link>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Thread column — primary focus */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <header className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight leading-snug">{t.subject}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[t.status]}>{statusLabel(tr, t.status)}</Badge>
              <SlaChip
                slaState={t.slaState}
                firstResponseDueAt={t.firstResponseDueAt}
                resolutionDueAt={t.resolutionDueAt}
              />
              {(t.reopenCount ?? 0) > 0 ? (
                <Badge tone="warning">
                  {tr('helpdesk.detail.reopenedBadge', { count: t.reopenCount ?? 0 })}
                </Badge>
              ) : null}
              {repeatComplainant ? (
                <Badge tone="danger">
                  <AlertTriangle className="size-3" /> {tr('helpdesk.detail.repeatComplainant')}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs sr-muted">
              {t.unit?.identifier
                ? tr('helpdesk.detail.unitPrefix', { unit: t.unit.identifier })
                : ''}
              {t.createdBy?.name ?? tr('helpdesk.detail.residentFallback')} ·{' '}
              {categoryLabel(tr, t.category)}
            </p>
          </header>

          {duplicateSuggestions.length > 0 ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm">
              <div className="font-medium flex items-center gap-1.5 text-sm">
                <Copy className="size-3.5 shrink-0" /> {tr('helpdesk.detail.possibleDuplicates')}
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
              className="relative overflow-hidden rounded-xl border border-sky-200/70 bg-sky-50/60 dark:bg-sky-950/20 dark:border-sky-700/40 pl-4 pr-4 py-3 text-sm flex items-center gap-2 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-sky-500"
              title="Tap a management message below to change which reply counts as the fix."
            >
              <CheckCircle2 className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{tr('helpdesk.pendingConfirmation')}</span>
            </div>
          ) : null}

          <Card className="p-5 shadow-sm">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={replyBodyId}>
                {internal ? tr('helpdesk.detail.internalNote') : tr('helpdesk.detail.sendReply')}
              </Label>
              <Textarea
                id={replyBodyId}
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={tr('helpdesk.detail.replyPlaceholder')}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm sr-muted">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                {tr('helpdesk.detail.internalNote')}
              </label>
              <Button
                type="submit"
                disabled={post.isPending || !body.trim()}
                loading={post.isPending}
              >
                <Send className="size-4" />
                {internal ? tr('actions.submit') : tr('helpdesk.detail.sendReply')}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar — metadata + actions */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card className="p-5 flex flex-col gap-4 shadow-sm">
            <h3 className="text-sm font-semibold">Details</h3>
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
                      {priorityLabel(tr, p)}
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
                      {categoryLabel(tr, c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="min-w-0">
                <span className="text-[11px] sr-muted uppercase tracking-wide">Assignee</span>
                <p className="text-sm truncate">{t.assignedTo?.name ?? tr('helpdesk.noAssignee')}</p>
              </div>
              {myId && t.assignedTo?.id !== myId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await update.mutateAsync({ id, assignedToUserId: myId });
                      toast.success(tr('helpdesk.actions.assignToMe'));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  <UserCheck className="size-4" />
                  {tr('helpdesk.detail.takeTicket')}
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-4 shadow-sm">
            <h3 className="text-sm font-semibold">{tr('helpdesk.wrapUp')}</h3>

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
                <Label htmlFor={actionNoteId}>{tr('helpdesk.proposePlaceholder')}</Label>
                <Textarea
                  id={actionNoteId}
                  rows={2}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={tr('helpdesk.proposePlaceholder')}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={runPropose} disabled={propose.isPending}>
                    <CheckCircle2 className="size-4" />
                    {tr('helpdesk.actions.markAsFixed')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetComposer}>
                    {tr('actions.cancel')}
                  </Button>
                </div>
              </div>
            ) : composer === 'request' ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={actionNoteId}>{tr('helpdesk.requestPlaceholder')}</Label>
                <Textarea
                  id={actionNoteId}
                  rows={2}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={tr('helpdesk.requestPlaceholder')}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={runRequest} disabled={requestResident.isPending}>
                    <UserPlus className="size-4" />
                    {tr('helpdesk.actions.askResident')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetComposer}>
                    {tr('actions.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => setComposer('propose')}
                  disabled={awaitingResident}
                  title={tr('helpdesk.actions.markAsFixedHint')}
                >
                  <CheckCircle2 className="size-4" />
                  {tr('helpdesk.actions.markAsFixed')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setComposer('request')}
                  title={tr('helpdesk.actions.askResidentHint')}
                >
                  <UserPlus className="size-4" />
                  {tr('helpdesk.actions.askResident')}
                </Button>
              </div>
            )}
          </Card>

          {composer === 'abusive' ? (
            <Card className="p-4 flex flex-col gap-2 border-red-200/60">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400">
                {tr('helpdesk.actions.closeMisuse')}
              </h3>
              <Label htmlFor={abusiveReasonId}>Reason shown to the resident</Label>
              <Textarea
                id={abusiveReasonId}
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
                  {tr('helpdesk.actions.closeAndNotify')}
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
              aria-label={tr('messages.threadActions')}
            >
              <MoreHorizontal className="size-4" />
              {tr('helpdesk.detail.moreActions')}
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left text-red-600 dark:text-red-400"
                    onClick={() => {
                      setMoreOpen(false);
                      setComposer('abusive');
                    }}
                  >
                    <Ban className="size-4 shrink-0" />
                    {tr('helpdesk.actions.closeMisuse')}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left"
                  onClick={exportPdf}
                >
                  <Download className="size-4 shrink-0" />
                  {tr('helpdesk.actions.downloadPdf')}
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
