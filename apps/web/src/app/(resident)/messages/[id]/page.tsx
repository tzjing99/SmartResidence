'use client';

import { SlaChip } from '@/components/sla-chip';
import { api } from '@/lib/api';
import { STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import {
  useAppealThread,
  useConfirmThreadResolution,
  useMe,
  usePostThreadMessage,
  useThread,
} from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton, Textarea, cn } from '@smartresidence/ui-web';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  MoreHorizontal,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
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
  const confirm = useConfirmThreadResolution(api);
  const appeal = useAppealThread(api);
  const [body, setBody] = React.useState('');
  const [rejectMode, setRejectMode] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [rejectExpectation, setRejectExpectation] = React.useState('');
  const [appealMode, setAppealMode] = React.useState(false);
  const [appealReason, setAppealReason] = React.useState('');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

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

  async function respondResolution(confirmed: boolean) {
    if (!confirmed) {
      setRejectMode(true);
      return;
    }
    try {
      await confirm.mutateAsync({ id, confirmed: true });
      toast.success("Thanks — we'll close this out.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitReject() {
    if (!rejectReason.trim() || !rejectExpectation.trim()) {
      toast.error("Please tell us what's still wrong and what you need");
      return;
    }
    try {
      await confirm.mutateAsync({
        id,
        confirmed: false,
        rejectReason: rejectReason.trim(),
        rejectExpectation: rejectExpectation.trim(),
      });
      toast.success('Sent back to management');
      setRejectMode(false);
      setRejectReason('');
      setRejectExpectation('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitAppeal() {
    if (appealReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }
    try {
      await appeal.mutateAsync({ id, reason: appealReason.trim() });
      toast.success('Ticket reopened — management will take another look');
      setAppealMode(false);
      setAppealReason('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

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
  if (!t) return <div className="sr-muted text-sm">Conversation not found.</div>;

  const closed = t.status === 'CLOSED';
  const resolved = t.status === 'RESOLVED';
  const pending = t.status === 'PENDING_RESIDENT_CONFIRMATION';
  const proposedMsg = pending
    ? t.messages.find((m) => m.id === t.resolutionProposedMessageId)
    : null;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link href="/messages" className="inline-flex items-center gap-1 text-sm sr-muted w-fit">
        <ArrowLeft className="size-4" /> All messages
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight leading-snug">{t.subject}</h2>
          <div ref={moreRef} className="relative shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="size-4" />
            </Button>
            {moreOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgb(var(--sr-border))]/40 text-left"
                  onClick={() => {
                    setMoreOpen(false);
                    exportPdf();
                  }}
                >
                  <Download className="size-4 shrink-0" />
                  Download PDF
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[t.status]}>{prettyLabel(t.status)}</Badge>
          <SlaChip
            slaState={t.slaState}
            firstResponseDueAt={t.firstResponseDueAt}
            resolutionDueAt={t.resolutionDueAt}
          />
          <span className="text-xs sr-muted">{prettyLabel(t.category)}</span>
        </div>
      </header>

      {pending && !rejectMode ? (
        <div className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="size-5 text-sky-600 shrink-0" />
            <div>
              <div className="font-medium">
                Management says this is fixed. Does that match what you see?
              </div>
            </div>
          </div>
          {proposedMsg ? (
            <div className="rounded-xl bg-white/60 dark:bg-black/20 px-3 py-2 text-sm ring-2 ring-sky-500">
              <div className="text-[11px] font-semibold text-sky-700 mb-1">Suggested fix</div>
              <div className="whitespace-pre-line">{proposedMsg.body}</div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => respondResolution(true)} disabled={confirm.isPending}>
              <CheckCircle2 className="size-4" />
              Yes, it&apos;s fixed
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => respondResolution(false)}
              disabled={confirm.isPending}
            >
              <XCircle className="size-4" />
              No, still an issue
            </Button>
          </div>
        </div>
      ) : null}

      {rejectMode ? (
        <Card className="p-4 flex flex-col gap-3">
          <div className="font-medium text-sm">Tell us what&apos;s still wrong</div>
          <Textarea
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="What's still not working?"
          />
          <Textarea
            rows={2}
            value={rejectExpectation}
            onChange={(e) => setRejectExpectation(e.target.value)}
            placeholder="What would 'fixed' look like for you?"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitReject} disabled={confirm.isPending}>
              Submit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {(resolved || closed) && !appealMode ? (
        <div className="rounded-xl border border-[rgb(var(--sr-border))] px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm sr-muted">
            {resolved ? 'This thread is resolved.' : 'This conversation is closed.'}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setAppealMode(true)}>
            <RotateCcw className="size-4" />
            Reopen this ticket
          </Button>
        </div>
      ) : null}

      {appealMode ? (
        <Card className="p-4 flex flex-col gap-3">
          <div className="font-medium text-sm">What still isn&apos;t fixed?</div>
          <Textarea
            rows={3}
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            placeholder="What's still wrong or missing? Tell us in a few words…"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitAppeal} disabled={appeal.isPending}>
              Reopen this ticket
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAppealMode(false)}>
              Cancel
            </Button>
          </div>
        </Card>
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
          const mine = m.author?.id === myId;
          const isProposed = t.resolutionProposedMessageId === m.id;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line',
                  mine
                    ? 'bg-coral-500 text-white rounded-br-sm'
                    : 'bg-[rgb(var(--sr-border))]/40 rounded-bl-sm',
                  isProposed && pending && 'ring-2 ring-sky-500',
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

      {closed || pending || resolved ? null : (
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
