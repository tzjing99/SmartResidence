import {
  useCastPollVote,
  useCondoPolls,
  useMyCondos,
  useMyUnits,
  usePoll,
} from '@smartresidence/api-client';
import type { Poll, PollStatus } from '@smartresidence/shared-types';
import { POLL_STATUS_LABELS, effectivePollStatus } from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  FadeInView,
  Pill,
  SkeletonList,
  palette,
  radius,
} from '@smartresidence/ui-mobile';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  RESIDENT_CORAL,
  RESIDENT_SOFT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticError, hapticSelection, hapticSuccess } from '../../src/lib/haptics';
import { useT } from '../../src/i18n/locale-provider';

type OwnedUnit = { id: string; identifier: string };

const STATUS_TONE: Record<PollStatus, 'neutral' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  OPEN: 'success',
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

export default function PollsScreen() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const pollsQuery = useCondoPolls(api, condo?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => pollsQuery.refetch().then(() => undefined), [pollsQuery]),
  );

  const polls = (pollsQuery.data?.items ?? []) as Poll[];
  const openPolls = polls.filter((p) => effectivePollStatus(p) === 'OPEN');
  const closedPolls = polls.filter((p) => effectivePollStatus(p) === 'CLOSED');

  return (
    <ResidentScreen
      eyebrow="MC polls"
      title={t('polls.title')}
      subtitle={t('polls.subtitle')}
      scrollProps={{ refreshControl }}
      headerAction={
        selectedId ? (
          <Button
            title="← Back to all polls"
            size="sm"
            variant="secondary"
            onPress={() => setSelectedId(null)}
          />
        ) : undefined
      }
    >
      {selectedId ? (
        <VotePanel pollId={selectedId} />
      ) : pollsQuery.isLoading ? (
        <SkeletonList rows={3} rowHeight={76} />
      ) : polls.length === 0 ? (
        <EmptyState
          title={t('mobile.polls.emptyTitle')}
          description="When management opens a consultation, it will appear here."
        />
      ) : (
        <>
          {openPolls.length > 0 ? (
            <>
              <ResidentSectionHeader title="Open for voting" />
              {openPolls.map((p, index) => (
                <FadeInView key={p.id} index={index}>
                  <PollListItem poll={p} onSelect={() => p.id && setSelectedId(p.id)} />
                </FadeInView>
              ))}
            </>
          ) : null}
          {closedPolls.length > 0 ? (
            <>
              <ResidentSectionHeader title="Recent results" />
              {closedPolls.map((p, index) => (
                <FadeInView key={p.id} index={index}>
                  <PollListItem poll={p} onSelect={() => p.id && setSelectedId(p.id)} />
                </FadeInView>
              ))}
            </>
          ) : null}
        </>
      )}
    </ResidentScreen>
  );
}

function PollListItem({ poll, onSelect }: { poll: Poll; onSelect: () => void }) {
  const status = effectivePollStatus(poll);
  return (
    <AnimatedPressable onPress={onSelect}>
      <Card style={residentStyles.card}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                {poll.title}
              </AppText>
              <Pill tone={STATUS_TONE[status]} label={POLL_STATUS_LABELS[status]} />
            </View>
            <AppText variant="meta" style={{ color: palette.mutedLight }}>
              {status === 'OPEN'
                ? `Closes ${fmtDate(poll.closesAt)}`
                : `${poll.results?.totalVotes ?? 0} unit(s) voted`}
            </AppText>
          </View>
          <AppText style={{ color: palette.mutedLight, fontSize: 20 }}>›</AppText>
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function VotePanel({ pollId }: { pollId: string }) {
  const t = useT();
  const pollQuery = usePoll(api, pollId);
  const castVote = useCastPollVote(api);
  const units = useMyUnits(api);
  const poll = pollQuery.data;

  const [unitId, setUnitId] = useState('');
  const [optionId, setOptionId] = useState('');

  const votedUnitIds = useMemo(
    () => new Set((poll?.myVotes ?? []).map((v) => v.unitId).filter(Boolean)),
    [poll?.myVotes],
  );

  const ownedUnits = useMemo<OwnedUnit[]>(() => {
    const rows = (units.data ?? []) as Array<{
      id: string;
      identifier: string;
      ownerships?: Array<{ status?: string }>;
    }>;
    return rows
      .filter((u) => u.ownerships?.some((o) => o.status === 'ACTIVE'))
      .map((u) => ({ id: u.id, identifier: u.identifier }));
  }, [units.data]);

  const availableUnits = ownedUnits.filter((u) => !votedUnitIds.has(u.id));

  if (pollQuery.isLoading || !poll) {
    return <SkeletonList rows={2} rowHeight={90} />;
  }

  const status = effectivePollStatus(poll);
  const isOpen = status === 'OPEN';
  const effectiveUnitId = unitId || availableUnits[0]?.id || '';
  const effectiveOptionId = optionId || poll.options?.[0]?.id || '';

  async function handleVote() {
    if (!effectiveUnitId || !effectiveOptionId) {
      Alert.alert('Select a unit', 'Pick which owned unit you are voting for.');
      return;
    }
    try {
      await castVote.mutateAsync({
        pollId,
        data: { unitId: effectiveUnitId, optionId: effectiveOptionId },
      });
      setUnitId('');
      setOptionId('');
      hapticSuccess();
      Alert.alert('Vote recorded', 'Your vote has been recorded for your unit.');
    } catch (err) {
      hapticError();
      Alert.alert('Could not record vote', (err as Error).message);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card style={[residentStyles.card, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: palette.textLight }}>
            {poll.title}
          </AppText>
          <Pill tone={STATUS_TONE[status]} label={POLL_STATUS_LABELS[status]} />
        </View>
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          {isOpen ? `Closes ${fmtDate(poll.closesAt)}` : `Closed ${fmtDate(poll.closesAt)}`}
        </AppText>
        {poll.description ? (
          <AppText variant="bodySm" style={{ color: palette.textLight, marginTop: 4 }}>
            {poll.description}
          </AppText>
        ) : null}
      </Card>

      {poll.myVotes && poll.myVotes.length > 0 ? (
        <Card style={[residentStyles.card, { gap: 6 }]}>
          <AppText style={{ fontWeight: '700', color: palette.textLight }}>Your votes</AppText>
          {poll.myVotes.map((v) => (
            <AppText key={v.unitId} variant="meta" style={{ color: palette.mutedLight }}>
              {v.unitIdentifier}: {v.optionLabel}
            </AppText>
          ))}
        </Card>
      ) : null}

      {isOpen ? (
        ownedUnits.length === 0 ? (
          <Card style={residentStyles.card}>
            <AppText variant="bodySm" style={{ color: palette.mutedLight }}>
              Only registered unit owners may vote. Tenants can view live results but cannot cast
              votes.
            </AppText>
          </Card>
        ) : availableUnits.length === 0 ? (
          <Card style={residentStyles.card}>
            <AppText variant="bodySm" style={{ color: palette.mutedLight }}>
              You have voted for all your owned units.
            </AppText>
          </Card>
        ) : (
          <Card style={[residentStyles.card, { gap: 12 }]}>
            <AppText style={{ fontWeight: '700', color: palette.textLight }}>
              Cast your owner vote
            </AppText>

            <View style={{ gap: 6 }}>
              <AppText variant="label">Voting as unit</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {availableUnits.map((u) => {
                  const active = effectiveUnitId === u.id;
                  return (
                    <Chip
                      key={u.id}
                      label={u.identifier}
                      active={active}
                      onPress={() => {
                        hapticSelection();
                        setUnitId(u.id);
                      }}
                    />
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <AppText variant="label">Your choice</AppText>
              {(poll.options ?? []).map((o) => {
                const active = effectiveOptionId === o.id;
                return (
                  <AnimatedPressable
                    key={o.id}
                    onPress={() => {
                      hapticSelection();
                      setOptionId(o.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: active ? 'rgba(255, 56, 92, 0.35)' : palette.borderLight,
                      backgroundColor: active ? RESIDENT_SOFT_CORAL : palette.surfaceLight,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: active ? RESIDENT_CORAL : palette.borderLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: RESIDENT_CORAL,
                          }}
                        />
                      ) : null}
                    </View>
                    <AppText style={{ flex: 1, color: palette.textLight }}>{o.label}</AppText>
                  </AnimatedPressable>
                );
              })}
            </View>

            <Button
              title={t('actions.castVote')}
              onPress={handleVote}
              loading={castVote.isPending}
              disabled={castVote.isPending || !effectiveUnitId}
            />
          </Card>
        )
      ) : null}

      {poll.results && poll.results.options.length > 0 ? (
        <Card style={[residentStyles.card, { gap: 10 }]}>
          <AppText style={{ fontWeight: '700', color: palette.textLight }}>
            {isOpen ? 'Live tallies' : 'Final results'}
          </AppText>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            {poll.results.totalVotes} unit(s) · {(poll.results.totalWeight ?? 0).toFixed(1)}% share
            weight
          </AppText>
          {poll.results.options.map((opt) => (
            <View key={opt.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <AppText variant="bodySm" style={{ color: palette.textLight, flex: 1 }}>
                  {opt.label}
                </AppText>
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  {opt.votePercent}% · {opt.weightPercent}% weighted
                </AppText>
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette.borderLight,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, opt.votePercent ?? 0)}%`,
                    backgroundColor: RESIDENT_CORAL,
                    borderRadius: 4,
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
