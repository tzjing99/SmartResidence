'use client';

import { Markdown } from '@/components/markdown';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useCastPollVote, useCondoPolls, useMyCondos, usePoll } from '@smartresidence/api-client';
import type { Poll, PollStatus } from '@smartresidence/shared-types';
import { POLL_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Label, Skeleton } from '@smartresidence/ui-web';
import { ChevronRight, Vote } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<PollStatus, 'neutral' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'warning',
};

function pollStatus(p: Poll): PollStatus {
  return p.status ?? 'DRAFT';
}

const selectCls = 'sr-select';

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PollResults({ poll }: { poll: Poll }) {
  if (!poll.results) return null;
  const totalWeight = poll.results.totalWeight ?? 0;
  const optionRows = poll.results.options ?? [];
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm sr-muted">
        {poll.results.totalVotes} unit{poll.results.totalVotes === 1 ? '' : 's'} ·{' '}
        {totalWeight.toFixed(1)}% share weight
      </p>
      {optionRows.map((opt) => (
        <div key={opt.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{opt.label}</span>
            <span className="sr-muted">
              {opt.votePercent}% units · {opt.weightPercent}% weighted
            </span>
          </div>
          <div className="h-2 rounded-full bg-[rgb(var(--sr-border))] overflow-hidden">
            <div
              className="h-full bg-[rgb(var(--sr-coral))] rounded-full"
              style={{ width: `${Math.min(100, opt.votePercent ?? 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VotePanel({ pollId, canVote }: { pollId: string; canVote: boolean }) {
  const t = useT();
  const pollQuery = usePoll(api, pollId);
  const castVote = useCastPollVote(api);
  const poll = pollQuery.data;

  const [unitId, setUnitId] = React.useState('');
  const [optionId, setOptionId] = React.useState('');

  const votedUnitIds = React.useMemo(
    () => new Set(poll?.myVotes?.map((v) => v.unitId).filter(Boolean) as string[]),
    [poll?.myVotes],
  );

  React.useEffect(() => {
    if (poll?.options?.length && !optionId) {
      setOptionId(poll.options[0]?.id ?? '');
    }
  }, [poll?.options, optionId]);

  if (pollQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!poll) return null;

  const isOpen = pollStatus(poll) === 'OPEN';
  const showVoteForm = canVote && isOpen;

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId || !optionId) return;
    try {
      await castVote.mutateAsync({ pollId, data: { unitId, optionId } });
      toast.success('Vote recorded for your unit');
      setUnitId('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold">{poll.title}</h2>
        <Badge tone={STATUS_TONE[pollStatus(poll)]}>{POLL_STATUS_LABELS[pollStatus(poll)]}</Badge>
      </div>
      <p className="text-sm sr-muted mb-4">
        {isOpen ? `Closes ${fmtDate(poll.closesAt)}` : `Closed ${fmtDate(poll.closesAt)}`}
      </p>

      <div className="prose prose-sm max-w-none mb-4">
        <Markdown>{poll.description ?? ''}</Markdown>
      </div>

      {poll.myVotes && poll.myVotes.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[rgb(var(--sr-border))] p-3 text-sm">
          <p className="font-medium mb-1">Your votes</p>
          <ul className="sr-muted space-y-0.5">
            {poll.myVotes.map((v) => (
              <li key={v.unitId}>
                {v.unitIdentifier}: {v.optionLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showVoteForm ? (
        <form
          onSubmit={handleVote}
          className="space-y-3 border-t border-[rgb(var(--sr-border))] pt-4"
        >
          <p className="text-sm font-medium">Cast your owner vote (one vote per unit you own)</p>
          <div>
            <Label htmlFor="vote-unit">Unit</Label>
            <InputUnitSelector
              pollId={pollId}
              value={unitId}
              onChange={setUnitId}
              votedUnitIds={votedUnitIds}
            />
          </div>
          <div>
            <Label htmlFor="vote-option">Your choice</Label>
            <select
              id="vote-option"
              className={selectCls}
              value={optionId}
              onChange={(e) => setOptionId(e.target.value)}
              required
            >
              {poll.options?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={castVote.isPending || !unitId}
            loading={castVote.isPending}
          >
            {t('actions.castVote')}
          </Button>
        </form>
      ) : !canVote && isOpen ? (
        <p className="text-sm sr-muted border-t border-[rgb(var(--sr-border))] pt-4">
          Only registered unit owners may vote. Tenants can view live results but cannot cast votes.
        </p>
      ) : null}

      {(pollStatus(poll) === 'OPEN' || pollStatus(poll) === 'CLOSED') && poll.results ? (
        <div className="border-t border-[rgb(var(--sr-border))] pt-4 mt-4">
          <p className="text-sm font-medium mb-2">
            {pollStatus(poll) === 'OPEN' ? 'Live tallies' : 'Final results'}
          </p>
          <PollResults poll={poll} />
        </div>
      ) : null}
    </Card>
  );
}

function InputUnitSelector({
  pollId,
  value,
  onChange,
  votedUnitIds,
}: {
  pollId: string;
  value: string;
  onChange: (v: string) => void;
  votedUnitIds: Set<string>;
}) {
  const [units, setUnits] = React.useState<Array<{ id: string; identifier: string }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await api.myUnits()) as Array<{
          id: string;
          identifier: string;
          ownerships?: Array<{ status?: string; userId?: string }>;
        }>;
        if (cancelled) return;
        const owned = rows.filter((u) => u.ownerships?.some((o) => o.status === 'ACTIVE'));
        setUnits(owned.map((u) => ({ id: u.id, identifier: u.identifier })));
        const firstUnvoted = owned.find((u) => !votedUnitIds.has(u.id));
        if (firstUnvoted && !value) onChange(firstUnvoted.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [votedUnitIds, value, onChange]);

  const available = units.filter((u) => !votedUnitIds.has(u.id));

  if (loading) return <Skeleton className="h-10 w-full" />;
  if (available.length === 0) {
    return <p className="text-sm sr-muted">You have voted for all your owned units.</p>;
  }

  return (
    <select
      id="vote-unit"
      className={selectCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
      <option value="">Select unit…</option>
      {available.map((u) => (
        <option key={u.id} value={u.id}>
          {u.identifier}
        </option>
      ))}
    </select>
  );
}

export default function ResidentPollsPage() {
  const t = useT();
  const { abilities } = useRoleGuard('resident');
  const canVote = hasAbility(abilities, 'vote', 'Poll');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const pollsQuery = useCondoPolls(api, condo?.id ?? null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const polls = pollsQuery.data?.items ?? [];
  const openPolls = polls.filter((p) => pollStatus(p) === 'OPEN');
  const closedPolls = polls.filter((p) => pollStatus(p) === 'CLOSED');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Vote className="size-6 text-[rgb(var(--sr-coral))]" />
          {t('polls.title')}
        </h1>
        <p className="text-sm sr-muted mt-1">
          Verified owner consultation — one vote per unit you own. Results are transparent to all
          residents.
        </p>
      </div>

      {selectedId ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            ← Back to list
          </Button>
          <VotePanel pollId={selectedId} canVote={canVote} />
        </div>
      ) : pollsQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : polls.length === 0 ? (
        <EmptyState
          title={t('polls.emptyTitle')}
          description="When management opens a consultation, it will appear here."
        />
      ) : (
        <div className="space-y-6">
          {openPolls.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide sr-muted mb-2">
                Open for voting
              </h2>
              <div className="space-y-2">
                {openPolls.map((p) => (
                  <PollListItem key={p.id} poll={p} onSelect={() => p.id && setSelectedId(p.id)} />
                ))}
              </div>
            </section>
          ) : null}
          {closedPolls.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide sr-muted mb-2">
                Recent results
              </h2>
              <div className="space-y-2">
                {closedPolls.map((p) => (
                  <PollListItem key={p.id} poll={p} onSelect={() => p.id && setSelectedId(p.id)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PollListItem({ poll, onSelect }: { poll: Poll; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <Card className="p-4 hover:border-[rgb(var(--sr-coral)/0.4)] transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{poll.title}</span>
              <Badge tone={STATUS_TONE[pollStatus(poll)]}>
                {POLL_STATUS_LABELS[pollStatus(poll)]}
              </Badge>
            </div>
            <p className="text-sm sr-muted mt-0.5">
              {pollStatus(poll) === 'OPEN'
                ? `Closes ${fmtDate(poll.closesAt)}`
                : `${poll.results?.totalVotes ?? 0} units voted`}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 sr-muted" />
        </div>
      </Card>
    </button>
  );
}
