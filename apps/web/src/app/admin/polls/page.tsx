'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCondoPolls,
  useCreatePoll,
  useMyCondos,
  usePoll,
  useUpdatePoll,
} from '@smartresidence/api-client';
import type { Poll, PollStatus } from '@smartresidence/shared-types';
import { POLL_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@smartresidence/ui-web';
import { ChevronRight, Plus, Trash2, Vote, X } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<PollStatus, 'neutral' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'warning',
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pollStatus(p: Poll): PollStatus {
  return p.status ?? 'DRAFT';
}

function PollResultsPanel({ poll }: { poll: Poll }) {
  if (!poll.results) return null;
  const { results } = poll;
  const totalWeight = results.totalWeight ?? 0;
  const optionRows = results.options ?? [];
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm sr-muted">
        {results.totalVotes} unit{results.totalVotes === 1 ? '' : 's'} voted ·{' '}
        {totalWeight.toFixed(1)}% share of votes counted
      </p>
      {optionRows.map((opt) => (
        <div key={opt.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{opt.label}</span>
            <span className="sr-muted">
              {opt.voteCount} ({opt.votePercent}%) · {opt.weightPercent}% weighted
            </span>
          </div>
          <div className="h-2 rounded-full bg-[rgb(var(--sr-border))] overflow-hidden">
            <div
              className="h-full bg-[rgb(var(--sr-coral))] rounded-full transition-all"
              style={{ width: `${Math.min(100, opt.votePercent ?? 0)}%` }}
            />
          </div>
        </div>
      ))}
      {pollStatus(poll) === 'CLOSED' && results.breakdown?.length ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Unit-by-unit breakdown</summary>
          <ul className="mt-2 space-y-1 sr-muted">
            {results.breakdown.map((v) => (
              <li key={`${v.unitId}-${v.votedAt}`}>
                {v.unitIdentifier}: {v.optionLabel} ({v.weight}% share)
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function PollDetailPanel({
  pollId,
  onClose,
}: {
  pollId: string;
  onClose: () => void;
}) {
  const pollQuery = usePoll(api, pollId);
  const updatePoll = useUpdatePoll(api);
  const poll = pollQuery.data;

  const openPoll = async () => {
    try {
      await updatePoll.mutateAsync({
        id: pollId,
        data: { status: 'OPEN', opensAt: new Date() },
      });
      toast.success('Poll is now open for owner voting');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const closePoll = async () => {
    try {
      await updatePoll.mutateAsync({ id: pollId, data: { status: 'CLOSED' } });
      toast.success('Poll closed');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (pollQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  if (!poll) return null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{poll.title}</h2>
            <Badge tone={STATUS_TONE[pollStatus(poll)]}>
              {POLL_STATUS_LABELS[pollStatus(poll)]}
            </Badge>
          </div>
          <p className="text-sm sr-muted">
            Opens {fmtDate(poll.opensAt)} · Closes {fmtDate(poll.closesAt)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-4 prose prose-sm max-w-none">
        <Markdown>{poll.description ?? ''}</Markdown>
      </div>

      <PollResultsPanel poll={poll} />

      <div className="mt-6 flex flex-wrap gap-2">
        {pollStatus(poll) === 'DRAFT' ? (
          <Button onClick={openPoll} loading={updatePoll.isPending}>
            Open for voting
          </Button>
        ) : null}
        {pollStatus(poll) === 'OPEN' ? (
          <Button variant="secondary" onClick={closePoll} disabled={updatePoll.isPending}>
            Close poll
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export default function AdminPollsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const pollsQuery = useCondoPolls(api, condo?.id ?? null, { manage: true });
  const createPoll = useCreatePoll(api);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [opensAt, setOpensAt] = React.useState('');
  const [closesAt, setClosesAt] = React.useState('');
  const [options, setOptions] = React.useState(['Yes', 'No']);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setOpensAt('');
    setClosesAt('');
    setOptions(['Yes', 'No']);
    setShowCreate(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condo?.id) return;
    const trimmed = options.map((o) => o.trim()).filter(Boolean);
    if (trimmed.length < 2) {
      toast.error('Add at least two options');
      return;
    }
    try {
      const poll = await createPoll.mutateAsync({
        condoId: condo.id,
        title: title.trim(),
        description: description.trim(),
        opensAt: opensAt ? new Date(opensAt) : undefined,
        closesAt: closesAt ? new Date(closesAt) : undefined,
        options: trimmed.map((label, position) => ({ label, position })),
      });
      toast.success('Poll draft created');
      resetForm();
      if (poll.id) setSelectedId(poll.id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const polls = pollsQuery.data?.items ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Vote className="size-6 text-[rgb(var(--sr-coral))]" />
            Owner polls
          </h1>
          <p className="text-sm sr-muted mt-1">
            Propose MC consultation items and collect verified owner votes — one vote per unit.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="size-4 mr-1.5" />
          New poll
        </Button>
      </div>

      {showCreate ? (
        <Card className="p-5 sm:p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="poll-title">Title</Label>
              <Input
                id="poll-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rooftop awning for Block A"
                required
                minLength={4}
              />
            </div>
            <div>
              <Label htmlFor="poll-desc">Description</Label>
              <Textarea
                id="poll-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the proposal and what owners are deciding…"
                rows={4}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="poll-opens">Opens (optional)</Label>
                <Input
                  id="poll-opens"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="poll-closes">Closes (optional)</Label>
                <Input
                  id="poll-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Options</Label>
              <div className="space-y-2 mt-1">
                {options.map((opt, idx) => (
                  <div key={`poll-opt-${idx}-${opt}`} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      required
                    />
                    {options.length > 2 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {options.length < 10 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setOptions([...options, ''])}
                  >
                    Add option
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={createPoll.isPending}>
                Save draft
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {selectedId ? (
        <PollDetailPanel pollId={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}

      {pollsQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : polls.length === 0 ? (
        <EmptyState
          title="No polls yet"
          description="Create a draft poll to consult verified unit owners on MC proposals."
        />
      ) : (
        <div className="space-y-2">
          {polls.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => p.id && setSelectedId(p.id)}
              className="w-full text-left"
            >
              <Card className="p-4 hover:border-[rgb(var(--sr-coral)/0.4)] transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{p.title}</span>
                      <Badge tone={STATUS_TONE[pollStatus(p)]}>
                        {POLL_STATUS_LABELS[pollStatus(p)]}
                      </Badge>
                    </div>
                    <p className="text-sm sr-muted mt-0.5 truncate">
                      {p.results?.totalVotes ?? 0} votes · closes {fmtDate(p.closesAt)}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 sr-muted" />
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
