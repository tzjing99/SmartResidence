'use client';

import { useT } from '@/i18n/locale-provider';
import { AdminPageHeader } from '@/components/admin-ui';
import { Markdown } from '@/components/markdown';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAddMeetingResolution,
  useCloseResolutionVoting,
  useCondoMeetings,
  useCreateMeeting,
  useMeeting,
  useMeetingProxies,
  useMyCondos,
  useOpenResolutionVoting,
  usePublishMeetingMinutes,
  usePublishMeetingNotice,
  useUpdateMeeting,
} from '@smartresidence/api-client';
import type {
  GeneralMeeting,
  GeneralMeetingKind,
  GeneralMeetingStatus,
} from '@smartresidence/shared-types';
import {
  FUND_LABELS,
  MEETING_KIND_LABELS,
  MEETING_STATUS_LABELS,
} from '@smartresidence/shared-types';
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
import { ChevronRight, Gavel, Plus, X } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<GeneralMeetingStatus, 'neutral' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'neutral',
  NOTICE_PUBLISHED: 'info',
  IN_PROGRESS: 'success',
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

function FinancialSnapshotTable({
  snapshot,
}: {
  snapshot: NonNullable<GeneralMeeting['financialSnapshot']>;
}) {
  return (
    <div className="mb-6">
      <h3 className="font-medium mb-2">Financial snapshot (at notice)</h3>
      <p className="text-sm sr-muted mb-2">Captured {fmtDate(snapshot.capturedAt)}</p>
      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--sr-border))]">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--sr-surface-muted))]">
            <tr>
              <th className="text-left p-2 font-medium">Fund</th>
              <th className="text-right p-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot.fundBalances ?? []).map((row) => (
              <tr key={row.fund} className="border-t border-[rgb(var(--sr-border))]">
                <td className="p-2">{FUND_LABELS[row.fund] ?? row.fund}</td>
                <td className="p-2 text-right tabular-nums">
                  {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MeetingDetailPanel({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const meetingQuery = useMeeting(api, meetingId);
  const proxiesQuery = useMeetingProxies(api, meetingId);
  const updateMeeting = useUpdateMeeting(api);
  const publishNotice = usePublishMeetingNotice(api);
  const publishMinutes = usePublishMeetingMinutes(api);
  const addResolution = useAddMeetingResolution(api);
  const openVoting = useOpenResolutionVoting(api);
  const closeVoting = useCloseResolutionVoting(api);

  const meeting = meetingQuery.data;
  const [resolutionTitle, setResolutionTitle] = React.useState('');
  const [resolutionDesc, setResolutionDesc] = React.useState('');
  const [minutesDraft, setMinutesDraft] = React.useState('');

  React.useEffect(() => {
    setMinutesDraft(meeting?.minutesBody ?? '');
  }, [meeting?.minutesBody]);

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

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge tone={STATUS_TONE[status]}>{MEETING_STATUS_LABELS[status]}</Badge>
            <span className="text-sm sr-muted">
              {MEETING_KIND_LABELS[meeting.kind as GeneralMeetingKind]}
            </span>
          </div>
          <h2 className="text-xl font-semibold">{meeting.title}</h2>
          <p className="text-sm sr-muted mt-1">Scheduled {fmtDate(meeting.scheduledAt)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {meeting.noticeBody ? (
        <div className="mb-6">
          <h3 className="font-medium mb-2">Notice</h3>
          <Markdown>{meeting.noticeBody}</Markdown>
        </div>
      ) : null}

      {meeting.financialSnapshot ? (
        <FinancialSnapshotTable snapshot={meeting.financialSnapshot} />
      ) : null}

      {status !== 'DRAFT' ? (
        <div className="mb-6">
          <h3 className="font-medium mb-2">Minutes</h3>
          {meeting.minutesPublishedAt ? (
            <Markdown>{meeting.minutesBody ?? ''}</Markdown>
          ) : (
            <>
              <Textarea
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                rows={6}
                placeholder="Meeting minutes (markdown)"
                className="mb-3"
              />
              {minutesDraft.trim() ? (
                <div className="mb-3 rounded-lg border border-[rgb(var(--sr-border))] p-3">
                  <p className="text-xs sr-muted mb-2">Preview</p>
                  <Markdown>{minutesDraft}</Markdown>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={updateMeeting.isPending || !minutesDraft.trim()}
                  loading={updateMeeting.isPending}
                  onClick={() =>
                    updateMeeting.mutate(
                      { id: meetingId, data: { minutesBody: minutesDraft.trim() } },
                      {
                        onSuccess: () => toast.success('Minutes saved'),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                >
                  Save minutes draft
                </Button>
                <Button
                  disabled={
                    publishMinutes.isPending ||
                    !minutesDraft.trim() ||
                    (status !== 'IN_PROGRESS' && status !== 'CLOSED')
                  }
                  loading={publishMinutes.isPending}
                  onClick={() =>
                    publishMinutes.mutate(
                      { id: meetingId, data: { minutesBody: minutesDraft.trim() } },
                      {
                        onSuccess: () => toast.success('Minutes published'),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                >
                  Publish minutes
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6">
        {status === 'DRAFT' ? (
          <Button
            disabled={publishNotice.isPending || !meeting.noticeBody?.trim()}
            loading={publishNotice.isPending}
            onClick={() =>
              publishNotice.mutate(meetingId, {
                onSuccess: () => toast.success('Notice published — owners notified'),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Publish notice
          </Button>
        ) : null}
        {status !== 'CLOSED' ? (
          <Button
            variant="secondary"
            disabled={updateMeeting.isPending}
            onClick={() =>
              updateMeeting.mutate(
                { id: meetingId, data: { status: 'CLOSED' } },
                {
                  onSuccess: () => toast.success('Meeting closed'),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Close meeting
          </Button>
        ) : null}
      </div>

      <h3 className="font-medium mb-3">Resolutions ({meeting.resolutions?.length ?? 0})</h3>
      <div className="space-y-3 mb-6">
        {(meeting.resolutions ?? []).map((res) => (
          <Card key={res.id} className="p-4 border border-[rgb(var(--sr-border))]">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-medium">{res.title}</p>
                {res.description ? (
                  <p className="text-sm sr-muted mt-1">{res.description}</p>
                ) : null}
                {res.poll?.status ? (
                  <Badge tone={res.poll.status === 'OPEN' ? 'success' : 'neutral'} className="mt-2">
                    Voting {res.poll.status.toLowerCase()}
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-2 shrink-0">
                {!res.pollId && status !== 'CLOSED' ? (
                  <Button
                    size="sm"
                    disabled={openVoting.isPending || status === 'DRAFT'}
                    onClick={() =>
                      openVoting.mutate(
                        { resolutionId: res.id! },
                        {
                          onSuccess: () => toast.success('Voting opened'),
                          onError: (e) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    Open voting
                  </Button>
                ) : null}
                {res.poll?.status === 'OPEN' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={closeVoting.isPending}
                    onClick={() =>
                      closeVoting.mutate(res.id!, {
                        onSuccess: () => toast.success('Voting closed'),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Close voting
                  </Button>
                ) : null}
              </div>
            </div>
            {res.poll?.results || res.resultsSnapshot ? (
              <div className="mt-3 space-y-2 text-sm">
                {((res.poll?.results ?? res.resultsSnapshot)?.options ?? []).map((opt) => (
                  <div key={opt.id} className="flex justify-between sr-muted">
                    <span>{opt.label}</span>
                    <span>
                      {opt.weightPercent}% · {opt.voteCount} units
                    </span>
                  </div>
                ))}
                <p className="text-xs sr-muted">
                  {(res.poll?.results ?? res.resultsSnapshot)?.totalVotes ?? 0} units ·{' '}
                  {((res.poll?.results ?? res.resultsSnapshot)?.totalWeight ?? 0).toFixed(1)}% share
                  weight
                  {res.resultsSnapshot ? ' (audited snapshot)' : ''}
                </p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {status !== 'CLOSED' ? (
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!resolutionTitle.trim()) return;
            addResolution.mutate(
              {
                meetingId,
                data: { title: resolutionTitle.trim(), description: resolutionDesc.trim() },
              },
              {
                onSuccess: () => {
                  toast.success('Resolution added');
                  setResolutionTitle('');
                  setResolutionDesc('');
                },
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          <h4 className="font-medium">Add resolution</h4>
          <Input
            placeholder="Resolution title"
            value={resolutionTitle}
            onChange={(e) => setResolutionTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={resolutionDesc}
            onChange={(e) => setResolutionDesc(e.target.value)}
            rows={2}
          />
          <Button
            type="submit"
            disabled={addResolution.isPending || resolutionTitle.length < 4}
            loading={addResolution.isPending}
          >
            <Plus className="h-4 w-4" />
            Add resolution
          </Button>
        </form>
      ) : null}

      <div className="border-t pt-4 mt-4">
        <h3 className="font-medium mb-2">Proxies ({proxiesQuery.data?.length ?? meeting.proxyCount ?? 0})</h3>
        {proxiesQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (proxiesQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm sr-muted">No proxy forms received yet.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {proxiesQuery.data!.map((p) => (
              <li key={p.id} className="sr-muted">
                <span className="font-medium text-[rgb(var(--sr-text))]">{p.unitIdentifier}</span> —{' '}
                {p.ownerName} → {p.proxyHolderName}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default function AdminGovernancePage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const meetingsQuery = useCondoMeetings(api, condo?.id ?? null, { manage: true });
  const createMeeting = useCreateMeeting(api);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<GeneralMeetingKind>('AGM');
  const [title, setTitle] = React.useState('');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [noticeBody, setNoticeBody] = React.useState('');

  const meetings = (meetingsQuery.data?.items ?? []) as GeneralMeeting[];

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <AdminPageHeader
        eyebrow="Compliance"
        icon={Gavel}
        title={t('admin.governance.title')}
        description={t('admin.governance.subtitle')}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-medium mb-3">New meeting</h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!condo?.id || !title.trim() || !scheduledAt) return;
                createMeeting.mutate(
                  {
                    condoId: condo.id,
                    kind,
                    title: title.trim(),
                    scheduledAt: new Date(scheduledAt),
                    noticeBody: noticeBody.trim(),
                  },
                  {
                    onSuccess: (m) => {
                      toast.success('Meeting created');
                      setTitle('');
                      setNoticeBody('');
                      if (m.id) setSelectedId(m.id);
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              <div>
                <Label>Type</Label>
                <select
                  className="sr-select mt-1 w-full"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as GeneralMeetingKind)}
                >
                  <option value="AGM">AGM</option>
                  <option value="EGM">EGM</option>
                </select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="2026 AGM"
                />
              </div>
              <div>
                <Label>Scheduled date & time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <div>
                <Label>Notice body (markdown)</Label>
                <Textarea
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  rows={4}
                  placeholder="Meeting agenda, venue, quorum requirements…"
                />
              </div>
              <Button
                type="submit"
                disabled={createMeeting.isPending || title.length < 4}
                loading={createMeeting.isPending}
              >
                <Plus className="h-4 w-4" />
                Create draft
              </Button>
            </form>
          </Card>

          <Card className="p-4">
            <h2 className="font-medium mb-3">Meetings</h2>
            {meetingsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : meetings.length === 0 ? (
              <EmptyState
                title="No meetings yet"
                description="Create an AGM or EGM to get started."
              />
            ) : (
              <ul className="divide-y divide-[rgb(var(--sr-border))]">
                {meetings.map((m) => {
                  const st = m.status ?? 'DRAFT';
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between py-3 text-left hover:bg-[rgb(var(--sr-surface-muted))] px-2 rounded-lg"
                        onClick={() => m.id && setSelectedId(m.id)}
                      >
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm sr-muted">
                            {MEETING_KIND_LABELS[m.kind as GeneralMeetingKind]} ·{' '}
                            {fmtDate(m.scheduledAt)}
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
          </Card>
        </div>

        <div>
          {selectedId ? (
            <MeetingDetailPanel meetingId={selectedId} onClose={() => setSelectedId(null)} />
          ) : (
            <Card className="p-6">
              <EmptyState
                title="Select a meeting"
                description="Choose a meeting from the list to manage notices, resolutions, and voting."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
