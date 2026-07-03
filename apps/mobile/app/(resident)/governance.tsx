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
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  FadeInView,
  Input,
  Pill,
  SkeletonList,
  palette,
} from '@smartresidence/ui-mobile';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';
import { hapticError, hapticSelection, hapticSuccess } from '../../src/lib/haptics';

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
  });
}

export default function GovernanceScreen() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const meetingsQuery = useCondoMeetings(api, condo?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => meetingsQuery.refetch().then(() => undefined), [meetingsQuery]),
  );

  const meetings = (meetingsQuery.data?.items ?? []) as GeneralMeeting[];

  return (
    <ResidentScreen
      eyebrow={t('nav.governance')}
      title={t('nav.screens.governance')}
      subtitle="Meeting notices, proxy forms, and resolution voting."
      scrollProps={{ refreshControl }}
      headerAction={
        selectedId ? (
          <Button
            title="← Back"
            size="sm"
            variant="secondary"
            onPress={() => setSelectedId(null)}
          />
        ) : undefined
      }
    >
      {selectedId ? (
        <MeetingDetail meetingId={selectedId} />
      ) : meetingsQuery.isLoading ? (
        <SkeletonList rows={3} rowHeight={76} />
      ) : meetings.length === 0 ? (
        <EmptyState
          title="No meetings scheduled"
          description="When management publishes a notice, it will appear here."
        />
      ) : (
        <>
          <ResidentSectionHeader title="Upcoming & recent" />
          {meetings.map((m, index) => (
            <FadeInView key={m.id} index={index}>
              <MeetingListItem meeting={m} onSelect={() => m.id && setSelectedId(m.id)} />
            </FadeInView>
          ))}
        </>
      )}
    </ResidentScreen>
  );
}

function MeetingListItem({
  meeting,
  onSelect,
}: {
  meeting: GeneralMeeting;
  onSelect: () => void;
}) {
  const status = meeting.status ?? 'DRAFT';
  return (
    <AnimatedPressable onPress={onSelect}>
      <Card style={residentStyles.card}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <AppText variant="title">{meeting.title}</AppText>
            <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 4 }}>
              {MEETING_KIND_LABELS[meeting.kind as GeneralMeetingKind]} ·{' '}
              {fmtDate(meeting.scheduledAt)}
            </AppText>
          </View>
          <Pill label={MEETING_STATUS_LABELS[status]} tone={STATUS_TONE[status]} />
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function MeetingDetail({ meetingId }: { meetingId: string }) {
  const meetingQuery = useMeeting(api, meetingId);
  const meeting = meetingQuery.data;
  const submitProxy = useSubmitMeetingProxy(api);
  const unitsQuery = useMyUnits(api);

  const [unitId, setUnitId] = useState('');
  const [holderName, setHolderName] = useState('');

  const existingProxyUnits = useMemo(
    () => new Set(meeting?.myProxies?.map((p) => p.unitId).filter(Boolean) as string[]),
    [meeting?.myProxies],
  );

  const ownedUnits = useMemo(() => {
    const rows = (unitsQuery.data ?? []) as Array<{
      id?: string;
      identifier?: string;
      ownerships?: Array<{ status?: string }>;
    }>;
    return rows.filter(
      (u) =>
        u.ownerships?.some((o) => o.status === 'ACTIVE') && u.id && !existingProxyUnits.has(u.id),
    );
  }, [unitsQuery.data, existingProxyUnits]);

  if (meetingQuery.isLoading || !meeting) {
    return <SkeletonList rows={2} rowHeight={90} />;
  }

  const status = meeting.status ?? 'DRAFT';
  const canProxy = status === 'NOTICE_PUBLISHED' || status === 'IN_PROGRESS';

  return (
    <>
      <Card style={residentStyles.card}>
        <Pill label={MEETING_STATUS_LABELS[status]} tone={STATUS_TONE[status]} />
        <AppText variant="title" style={{ marginTop: 8 }}>
          {meeting.title}
        </AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 4 }}>
          {fmtDate(meeting.scheduledAt)}
        </AppText>
        {meeting.noticeBody ? (
          <AppText variant="body" style={{ marginTop: 12 }}>
            {meeting.noticeBody.slice(0, 500)}
            {meeting.noticeBody.length > 500 ? '…' : ''}
          </AppText>
        ) : null}
      </Card>

      {canProxy && ownedUnits.length > 0 ? (
        <Card style={[residentStyles.card, { marginTop: 12 }]}>
          <AppText variant="subheading">Submit proxy</AppText>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ownedUnits.map((u) => (
                <Chip
                  key={u.id}
                  label={u.identifier ?? u.id ?? ''}
                  active={unitId === u.id}
                  onPress={() => {
                    hapticSelection();
                    if (u.id) setUnitId(u.id);
                  }}
                />
              ))}
            </View>
            <Input
              placeholder="Proxy holder name"
              value={holderName}
              onChangeText={setHolderName}
            />
            <Button
              title="Submit proxy"
              disabled={submitProxy.isPending || !unitId || holderName.length < 2}
              loading={submitProxy.isPending}
              onPress={() =>
                submitProxy.mutate(
                  {
                    meetingId,
                    data: { unitId, proxyHolderName: holderName.trim() },
                  },
                  {
                    onSuccess: () => {
                      hapticSuccess();
                      Alert.alert('Proxy submitted');
                      setHolderName('');
                    },
                    onError: (e) => {
                      hapticError();
                      Alert.alert('Error', e.message);
                    },
                  },
                )
              }
            />
          </View>
        </Card>
      ) : null}

      {(meeting.resolutions?.length ?? 0) > 0 ? (
        <>
          <ResidentSectionHeader title="Resolutions" />
          {meeting.resolutions!.map((res) => (
            <ResolutionCard key={res.id} resolution={res} />
          ))}
        </>
      ) : null}
    </>
  );
}

function ResolutionCard({ resolution }: { resolution: MeetingResolution }) {
  const castVote = useCastResolutionVote(api);
  const unitsQuery = useMyUnits(api);
  const [unitId, setUnitId] = useState('');
  const [optionId, setOptionId] = useState('');

  const votedUnitIds = useMemo(
    () => new Set(resolution.poll?.myVotes?.map((v) => v.unitId).filter(Boolean) as string[]),
    [resolution.poll?.myVotes],
  );

  const ownedUnits = useMemo(() => {
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
    <Card style={[residentStyles.card, { marginBottom: 8 }]}>
      <AppText variant="subheading">{resolution.title}</AppText>
      {resolution.poll?.results?.options?.map((opt) => (
        <AppText key={opt.id} variant="meta" style={{ color: palette.mutedLight, marginTop: 4 }}>
          {opt.label}: {opt.weightPercent}% weighted
        </AppText>
      ))}

      {pollOpen && ownedUnits.length > 0 ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ownedUnits.map((u) => (
              <Chip
                key={u.id}
                label={u.identifier ?? ''}
                active={unitId === u.id}
                onPress={() => {
                  hapticSelection();
                  if (u.id) setUnitId(u.id);
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(resolution.poll?.options ?? []).map((opt) => (
              <Chip
                key={opt.id}
                label={opt.label ?? ''}
                active={optionId === opt.id}
                onPress={() => {
                  hapticSelection();
                  if (opt.id) setOptionId(opt.id);
                }}
              />
            ))}
          </View>
          <Button
            title="Cast vote"
            disabled={castVote.isPending || !unitId || !optionId}
            loading={castVote.isPending}
            onPress={() =>
              resolution.id &&
              castVote.mutate(
                { resolutionId: resolution.id, data: { unitId, optionId } },
                {
                  onSuccess: () => {
                    hapticSuccess();
                    Alert.alert('Vote recorded');
                  },
                  onError: (e) => {
                    hapticError();
                    Alert.alert('Error', e.message);
                  },
                },
              )
            }
          />
        </View>
      ) : resolution.poll?.myVotes?.length ? (
        <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 8 }}>
          Voted on {resolution.poll.myVotes.length} unit(s)
        </AppText>
      ) : null}
    </Card>
  );
}
