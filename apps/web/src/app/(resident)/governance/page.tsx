'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { hasAbility } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
import {
  useCastResolutionVote,
  useCondoMeetings,
  useMeeting,
  useMyCondos,
  useMyUnits,
  useSubmitMeetingProxy,
} from '@smartresidence/api-client';
import type {
  GeneralMeeting,
  GeneralMeetingKind,
  GeneralMeetingStatus,
  MeetingResolution,
} from '@smartresidence/shared-types';
import { MEETING_KIND_LABELS, MEETING_STATUS_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { ChevronRight, Gavel, Loader2 } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<GeneralMeetingStatus, 'neutral' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'neutral',
  NOTICE_PUBLISHED: 'info',
  IN_PROGRESS: 'success',
  CLOSED: 'warning',
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProxyForm({
  meetingId,
  canSubmitProxy,
  existingUnitIds,
}: {
  meetingId: string;
  canSubmitProxy: boolean;
  existingUnitIds: Set<string>;
}) {
  const unitsQuery = useMyUnits(api);
  const submitProxy = useSubmitMeetingProxy(api);
  const [unitId, setUnitId] = React.useState('');
  const [holderName, setHolderName] = React.useState('');
  const [holderContact, setHolderContact] = React.useState('');

  const ownedUnits = React.useMemo(() => {
    const rows = (unitsQuery.data ?? []) as Array<{
      id?: string;
      identifier?: string;
      ownerships?: Array<{ status?: string }>;
    }>;
    return rows.filter(
      (u) => u.ownerships?.some((o) => o.status === 'ACTIVE') && u.id && !existingUnitIds.has(u.id),
    );
  }, [unitsQuery.data, existingUnitIds]);

  if (!canSubmitProxy) return null;

  return (
    <form
      className="space-y-3 border-t pt-4 mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!unitId || !holderName.trim()) return;
        submitProxy.mutate(
          {
            meetingId,
            data: {
              unitId,
              proxyHolderName: holderName.trim(),
              proxyHolderContact: holderContact.trim() || undefined,
            },
          },
          {
            onSuccess: () => {
              toast.success('Proxy submitted');
              setHolderName('');
              setHolderContact('');
            },
            onError: (err) => toast.error(err.message),
          },
        );
      }}
    >
      <h3 className="font-medium">Submit proxy</h3>
      <p className="text-sm sr-muted">
        Appoint someone to vote on your behalf. One proxy per unit.
      </p>
      {ownedUnits.length === 0 ? (
        <p className="text-sm sr-muted">All your units already have a proxy submitted.</p>
      ) : (
        <>
          <div>
            <Label>Unit</Label>
            <select
              className="sr-select mt-1 w-full"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">Select unit</option>
              {ownedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.identifier}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Proxy holder name</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <div>
            <Label>Contact (optional)</Label>
            <Input value={holderContact} onChange={(e) => setHolderContact(e.target.value)} />
          </div>
          <Button
            type="submit"
            disabled={submitProxy.isPending || !unitId || holderName.length < 2}
          >
            {submitProxy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit proxy
          </Button>
        </>
      )}
    </form>
  );
}

function ResolutionVotePanel({
  resolution,
  canVote,
}: {
  resolution: MeetingResolution;
  canVote: boolean;
}) {
  const castVote = useCastResolutionVote(api);
  const unitsQuery = useMyUnits(api);
  const [unitId, setUnitId] = React.useState('');
  const [optionId, setOptionId] = React.useState('');

  const votedUnitIds = React.useMemo(
    () => new Set(resolution.poll?.myVotes?.map((v) => v.unitId).filter(Boolean) as string[]),
    [resolution.poll?.myVotes],
  );

  const ownedUnits = React.useMemo(() => {
    const rows = (unitsQuery.data ?? []) as Array<{
      id?: string;
      identifier?: string;
      ownerships?: Array<{ status?: string }>;
    }>;
    return rows.filter(
      (u) => u.ownerships?.some((o) => o.status === 'ACTIVE') && u.id && !votedUnitIds.has(u.id),
    );
  }, [unitsQuery.data, votedUnitIds]);

  const pollOpen = resolution.poll?.status === 'OPEN';

  return (
    <Card className="p-4 border border-[rgb(var(--sr-border))]">
      <p className="font-medium">{resolution.title}</p>
      {resolution.description ? (
        <p className="text-sm sr-muted mt-1">{resolution.description}</p>
      ) : null}

      {resolution.poll?.results ? (
        <div className="mt-3 space-y-2">
          {(resolution.poll.results.options ?? []).map((opt) => (
            <div key={opt.id} className="text-sm">
              <div className="flex justify-between">
                <span>{opt.label}</span>
                <span className="sr-muted">
                  {opt.weightPercent}% weighted · {opt.voteCount} units
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[rgb(var(--sr-border))] mt-1 overflow-hidden">
                <div
                  className="h-full bg-[rgb(var(--sr-coral))]"
                  style={{ width: `${Math.min(100, opt.weightPercent ?? 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {pollOpen && canVote && ownedUnits.length > 0 ? (
        <form
          className="mt-4 space-y-3 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!resolution.id || !unitId || !optionId) return;
            castVote.mutate(
              { resolutionId: resolution.id, data: { unitId, optionId } },
              {
                onSuccess: () => toast.success('Vote recorded'),
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          <div>
            <Label>Vote as unit</Label>
            <select
              className="sr-select mt-1 w-full"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">Select unit</option>
              {ownedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.identifier}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Your vote</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(resolution.poll?.options ?? []).map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={optionId === opt.id ? 'primary' : 'secondary'}
                  onClick={() => opt.id && setOptionId(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={castVote.isPending || !unitId || !optionId}>
            {castVote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cast vote
          </Button>
        </form>
      ) : resolution.poll?.myVotes?.length ? (
        <p className="text-sm sr-muted mt-3">
          You voted:{' '}
          {resolution.poll.myVotes.map((v) => `${v.unitIdentifier}: ${v.optionLabel}`).join(', ')}
        </p>
      ) : pollOpen ? (
        <p className="text-sm sr-muted mt-3">You have voted on all eligible units.</p>
      ) : null}
    </Card>
  );
}

function MeetingDetail({
  meetingId,
  canVote,
  canSubmitProxy,
}: { meetingId: string; canVote: boolean; canSubmitProxy: boolean }) {
  const meetingQuery = useMeeting(api, meetingId);
  const meeting = meetingQuery.data;

  if (meetingQuery.isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (!meeting) return null;

  const status = meeting.status ?? 'DRAFT';
  const existingProxyUnits = new Set(
    meeting.myProxies?.map((p) => p.unitId).filter(Boolean) as string[],
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <Badge tone={STATUS_TONE[status]}>{MEETING_STATUS_LABELS[status]}</Badge>
        <span className="text-sm sr-muted">
          {MEETING_KIND_LABELS[meeting.kind as GeneralMeetingKind]}
        </span>
      </div>
      <h2 className="text-xl font-semibold">{meeting.title}</h2>
      <p className="text-sm sr-muted mt-1">{fmtDate(meeting.scheduledAt)}</p>

      {meeting.noticeBody ? (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Notice</h3>
          <Markdown>{meeting.noticeBody}</Markdown>
        </div>
      ) : null}

      {(status === 'NOTICE_PUBLISHED' || status === 'IN_PROGRESS') && (
        <ProxyForm
          meetingId={meetingId}
          canSubmitProxy={canSubmitProxy}
          existingUnitIds={existingProxyUnits}
        />
      )}

      {meeting.myProxies?.length ? (
        <div className="mt-4 text-sm">
          <h3 className="font-medium mb-1">Your proxies</h3>
          <ul className="sr-muted space-y-1">
            {meeting.myProxies.map((p) => (
              <li key={p.id}>
                {p.unitIdentifier}: {p.proxyHolderName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(meeting.resolutions?.length ?? 0) > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="font-medium">Resolutions</h3>
          {meeting.resolutions!.map((res) => (
            <ResolutionVotePanel key={res.id} resolution={res} canVote={canVote} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export default function ResidentGovernancePage() {
  const { abilities } = useRoleGuard('resident');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const meetingsQuery = useCondoMeetings(api, condo?.id ?? null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const canVote = hasAbility(abilities, 'vote', 'MeetingResolution');
  const canSubmitProxy = hasAbility(abilities, 'submit-proxy', 'MeetingProxy');

  const meetings = (meetingsQuery.data?.items ?? []) as GeneralMeeting[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title flex items-center gap-2">
          <Gavel className="size-6 text-coral-500" aria-hidden />
          Governance
        </h2>
        <p className="sr-muted mt-1">
          AGM and EGM notices, proxy forms, and voting on building resolutions.
        </p>
      </header>

      {selectedId ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            ← All meetings
          </Button>
          <MeetingDetail meetingId={selectedId} canVote={canVote} canSubmitProxy={canSubmitProxy} />
        </>
      ) : meetingsQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : meetings.length === 0 ? (
        <EmptyState
          title="No meetings scheduled"
          description="When management publishes an AGM or EGM notice, it will appear here."
        />
      ) : (
        <ul className="divide-y divide-[rgb(var(--sr-border))] border border-[rgb(var(--sr-border))] rounded-xl overflow-hidden">
          {meetings.map((m) => {
            const st = m.status ?? 'DRAFT';
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgb(var(--sr-surface-muted))]"
                  onClick={() => m.id && setSelectedId(m.id)}
                >
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-sm sr-muted">
                      {MEETING_KIND_LABELS[m.kind as GeneralMeetingKind]} · {fmtDate(m.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[st]}>{MEETING_STATUS_LABELS[st]}</Badge>
                    <ChevronRight className="h-4 w-4 sr-muted" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
