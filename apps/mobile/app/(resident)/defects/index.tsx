import {
  useCreateDefect,
  useCreateHandoverReport,
  useMyUnits,
  useUnitDefectReports,
  useUnitDefects,
  useUnitHandoverTemplate,
} from '@smartresidence/api-client';
import { defectReference, handoverDefectTitle } from '@smartresidence/shared-types';
import type {
  DefectReportSummary,
  DefectStatus,
  HandoverReportItemInput,
  HandoverTemplate,
} from '@smartresidence/shared-types';
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
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { DefectSubmissionProgress } from '../../../src/components/defect-submission-progress';
import { PhotoPicker } from '../../../src/components/photo-picker';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  useResidentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { useT } from '../../../src/i18n/locale-provider';
import { api } from '../../../src/lib/api';
import { usePhotoUpload } from '../../../src/lib/use-photo-upload';

type Mode = 'single' | 'handover';

export default function DefectsScreen() {
  const t = useT();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const defects = useUnitDefects(api, unit?.id ?? null);
  const reports = useUnitDefectReports(api, unit?.id ?? null);
  const [mode, setMode] = useState<Mode>('single');
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () => Promise.all([defects.refetch(), reports.refetch()]).then(() => undefined),
      [defects, reports],
    ),
  );

  const items = [
    ...(reports.data ?? []).map((r) => ({ kind: 'package' as const, data: r })),
    ...((defects.data?.items as any[]) ?? []).map((d) => ({ kind: 'defect' as const, data: d })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());
  const historyLoading = defects.isLoading || reports.isLoading;

  return (
    <ResidentScreen
      eyebrow={t('defects.title')}
      title={t('defects.newDefect')}
      subtitle={t('defects.subtitle')}
      scrollProps={{ refreshControl }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title={t('mobile.defects.singleDefect')}
          variant={mode === 'single' ? 'primary' : 'secondary'}
          size="sm"
          style={{ flexGrow: 1 }}
          onPress={() => setMode('single')}
        />
        <Button
          title="Multiple defects"
          variant={mode === 'handover' ? 'primary' : 'secondary'}
          size="sm"
          style={{ flexGrow: 1 }}
          onPress={() => setMode('handover')}
        />
      </View>

      {mode === 'single' ? (
        <SingleDefectForm unitId={unit?.id} />
      ) : (
        <HandoverComposer unitId={unit?.id} />
      )}

      <ResidentSectionHeader
        title={t('mobile.defects.repairHistory')}
        subtitle="Open and completed reports stay here for reference."
      />

      {historyLoading ? (
        <SkeletonList rows={3} rowHeight={80} />
      ) : items.length === 0 ? (
        <EmptyState title={t('mobile.defects.emptyTitle')} description={t('defects.emptyDesc')} />
      ) : (
        items.map((row, index) => (
          <FadeInView
            key={row.kind === 'package' ? `package-${row.data.id}` : `defect-${row.data.id}`}
            index={index}
          >
            {row.kind === 'package' ? (
              <PackageCard report={row.data} />
            ) : (
              <StandaloneDefectCard defect={row.data} />
            )}
          </FadeInView>
        ))
      )}
    </ResidentScreen>
  );
}

function StandaloneDefectCard({
  defect,
}: {
  defect: { id: string; title: string; category: string; status: DefectStatus; createdAt: string };
}) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useResidentStyles();

  return (
    <AnimatedPressable onPress={() => router.push(`/(resident)/defects/${defect.id}` as Href)}>
      <Card style={styles.card}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={{ fontWeight: '700', color: colors.fg }} numberOfLines={2}>
              {defect.title}
            </AppText>
            <AppText variant="meta" style={{ color: colors.muted, marginTop: 2 }}>
              {defect.category} · {new Date(defect.createdAt).toLocaleDateString()}
            </AppText>
          </View>
          <Pill
            tone={
              defect.status === 'CLOSED' || defect.status === 'RESOLVED'
                ? 'success'
                : defect.status === 'NEW'
                  ? 'primary'
                  : 'info'
            }
            label={
              defect.status === 'RESOLVED'
                ? t('defects.waitingSignOff')
                : prettyLabel(defect.status)
            }
          />
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function PackageCard({ report }: { report: DefectReportSummary }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const status = reportStatus(report);
  const done = (report.statusCounts.RESOLVED ?? 0) + (report.statusCounts.CLOSED ?? 0);
  const pct = report.itemCount ? Math.round((done / report.itemCount) * 100) : 0;

  return (
    <AnimatedPressable
      onPress={() => router.push(`/(resident)/defects/package/${report.id}` as Href)}
    >
      <Card style={styles.card}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={{ fontWeight: '700', color: colors.fg }}>
              {t('defects.defectReport')}
            </AppText>
            <AppText
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: colors.coral,
                marginTop: 2,
              }}
            >
              {defectReference(report.id)}
            </AppText>
            <AppText variant="meta" style={{ color: colors.muted, marginTop: 2 }}>
              {report.itemCount} defect(s) · {new Date(report.createdAt).toLocaleDateString()}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 999,
                    backgroundColor: colors.coral,
                  }}
                />
              </View>
              <AppText variant="meta" style={{ color: colors.muted }}>
                {done}/{report.itemCount} fixed
              </AppText>
            </View>
          </View>
          <Pill
            tone={
              status === 'CLOSED' || status === 'RESOLVED'
                ? 'success'
                : status === 'NEW'
                  ? 'primary'
                  : 'info'
            }
            label={status === 'RESOLVED' ? t('defects.waitingSignOff') : prettyLabel(status)}
          />
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function reportStatus(report: DefectReportSummary): DefectStatus {
  const counts = report.statusCounts;
  const total = report.itemCount;
  const closed = counts.CLOSED ?? 0;
  const resolved = counts.RESOLVED ?? 0;
  if ((counts.REOPENED ?? 0) > 0) return 'REOPENED';
  if (closed >= total && total > 0) return 'CLOSED';
  if (resolved + closed >= total && total > 0) return 'RESOLVED';
  if ((counts.IN_PROGRESS ?? 0) > 0) return 'IN_PROGRESS';
  if ((counts.ASSIGNED ?? 0) > 0) return 'ASSIGNED';
  if ((counts.ACK ?? 0) > 0) return 'ACK';
  return 'NEW';
}

function SingleDefectForm({ unitId }: { unitId?: string }) {
  const t = useT();
  const create = useCreateDefect(api);
  const photo = usePhotoUpload();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const fieldStyle = useMemo(
    () => ({
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.fg,
    }),
    [colors],
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function submit() {
    if (!unitId || !title.trim() || !description.trim()) {
      Alert.alert(t('mobile.defects.fillTitleDesc'));
      return;
    }
    if (photo.uploading) {
      Alert.alert(t('mobile.defects.pleaseWait'), t('mobile.defects.photosUploading'));
      return;
    }
    try {
      await create.mutateAsync({
        unitId,
        title: title.trim(),
        description: description.trim(),
        category: 'Other',
        attachmentIds: photo.attachmentIds.length ? photo.attachmentIds : undefined,
      });
      setTitle('');
      setDescription('');
      photo.reset();
      Alert.alert(t('mobile.defects.submitted'), t('mobile.defects.submittedBody'));
    } catch (err) {
      Alert.alert(t('mobile.defects.couldNotSubmit'), (err as Error).message);
    }
  }

  return (
    <Card style={[styles.card, { gap: spacing.sm }]}>
      <View style={{ gap: 4 }}>
        <AppText variant="subheading">Submit a defect</AppText>
        <AppText variant="meta" style={{ color: colors.muted }}>
          A short title and photo help the team route it faster.
        </AppText>
      </View>
      <TextInput
        placeholder="Title"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        style={fieldStyle}
      />
      <TextInput
        placeholder="What's wrong?"
        placeholderTextColor={colors.muted}
        value={description}
        onChangeText={setDescription}
        multiline
        style={[
          fieldStyle,
          { height: 90, marginTop: 10, textAlignVertical: 'top', paddingTop: 10 },
        ]}
      />
      <PhotoPicker controller={photo} />
      <Button
        title={create.isPending ? 'Submitting…' : 'Submit'}
        loading={create.isPending}
        onPress={submit}
        size="sm"
        disabled={photo.uploading}
      />
    </Card>
  );
}

interface DraftItem extends HandoverReportItemInput {
  key: string;
  displayTitle: string;
}

function HandoverComposer({ unitId }: { unitId?: string }) {
  const t = useT();
  const template = useUnitHandoverTemplate(api, unitId ?? null);
  const create = useCreateHandoverReport(api);
  const photo = usePhotoUpload();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const fieldStyle = useMemo(
    () => ({
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.fg,
    }),
    [colors],
  );
  const chipLabel = useMemo(
    () => ({ color: colors.muted, marginTop: 6, marginBottom: 2 }),
    [colors.muted],
  );

  const [items, setItems] = useState<DraftItem[]>([]);
  const [roomIdx, setRoomIdx] = useState(0);
  const [elementId, setElementId] = useState<string | null>(null);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting' | 'success'>('idle');

  const data = template.data as HandoverTemplate | undefined;
  const room = data?.spaces[roomIdx];
  const spaceTree = data?.taxonomy.find((s) => s.id === room?.spaceTypeId);
  const elements = spaceTree?.elements ?? [];
  const selectedElement = elements.find((e) => e.id === elementId);
  const issues = selectedElement?.issues ?? [];

  function addItem() {
    if (!room) return;
    if (photo.uploading) {
      Alert.alert(t('mobile.defects.pleaseWait'), t('mobile.defects.photosUploading'));
      return;
    }
    if (elements.length > 0 && !elementId) {
      Alert.alert(t('mobile.defects.pickElement'));
      return;
    }
    if (elements.length === 0 && !note.trim()) {
      Alert.alert(t('mobile.defects.addNote'));
      return;
    }
    const issue = issues.find((i) => i.id === issueId);
    const displayTitle = handoverDefectTitle({
      spaceLabel: room.spaceLabel,
      elementName: selectedElement?.name ?? null,
      issueName: issue?.name ?? null,
    });
    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        spaceLabel: room.spaceLabel,
        spaceTypeId: room.spaceTypeId ?? undefined,
        elementId: elementId ?? undefined,
        issueId: issueId ?? undefined,
        note: note.trim() || undefined,
        attachmentIds: photo.attachmentIds.length ? [...photo.attachmentIds] : undefined,
        displayTitle,
      },
    ]);
    setElementId(null);
    setIssueId(null);
    setNote('');
    photo.reset();
  }

  async function submit() {
    if (!unitId || items.length === 0 || submitPhase !== 'idle') return;
    setSubmitPhase('submitting');
    const count = items.length;
    try {
      await create.mutateAsync({
        unitId,
        items: items.map(({ key, displayTitle, ...item }) => item),
      });
      setSubmitPhase('success');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setItems([]);
      setSubmitPhase('idle');
      Alert.alert(t('mobile.defects.submitted'), t('mobile.defects.submittedCount', { count }));
    } catch (err) {
      setSubmitPhase('idle');
      Alert.alert(t('mobile.defects.couldNotSubmit'), (err as Error).message);
    }
  }

  if (template.isLoading) {
    return (
      <Card style={styles.card}>
        <AppText variant="meta" style={{ color: colors.muted }}>
          Loading your unit layout…
        </AppText>
      </Card>
    );
  }

  if (!data || data.spaces.length === 0) {
    return (
      <Card style={styles.card}>
        <AppText variant="subheading">No unit layout yet</AppText>
        <AppText variant="meta" style={{ color: colors.muted, marginTop: 4 }}>
          Your unit doesn&apos;t have a type with rooms assigned. Ask management to set your unit
          type before reporting multiple defects.
        </AppText>
      </Card>
    );
  }

  return (
    <>
      <DefectSubmissionProgress
        visible={submitPhase !== 'idle'}
        itemCount={items.length}
        complete={submitPhase === 'success'}
      />
      <Card style={[styles.card, { gap: spacing.sm }]}>
        <View style={{ gap: 4 }}>
          <AppText variant="subheading">Multiple defects</AppText>
          <AppText variant="meta" style={{ color: colors.muted }}>
            {data.unitTypeName ? `Layout: ${data.unitTypeName}` : 'Add issues room by room.'}
          </AppText>
        </View>

        <AppText variant="meta" style={chipLabel}>
          Room
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
            {data.spaces.map((s, i) => (
              <Chip
                key={s.spaceLabel}
                label={s.spaceLabel}
                active={i === roomIdx}
                onPress={() => {
                  setRoomIdx(i);
                  setElementId(null);
                  setIssueId(null);
                }}
              />
            ))}
          </View>
        </ScrollView>

        {elements.length > 0 ? (
          <>
            <AppText variant="meta" style={chipLabel}>
              Element
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {elements.map((el) => (
                <Chip
                  key={el.id}
                  label={el.name}
                  active={el.id === elementId}
                  onPress={() => {
                    setElementId(el.id);
                    setIssueId(null);
                  }}
                />
              ))}
            </View>

            {issues.length > 0 ? (
              <>
                <AppText variant="meta" style={chipLabel}>
                  Issue (optional)
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {issues.map((iss) => (
                    <Chip
                      key={iss.id}
                      label={iss.name}
                      active={iss.id === issueId}
                      onPress={() => setIssueId(issueId === iss.id ? null : iss.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <AppText variant="meta" style={{ color: colors.muted }}>
            No checklist for this room — describe the issue in the note.
          </AppText>
        )}

        <TextInput
          placeholder="Note (optional)"
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={setNote}
          multiline
          style={[
            fieldStyle,
            { height: 70, marginTop: 4, textAlignVertical: 'top', paddingTop: 10 },
          ]}
        />

        <PhotoPicker controller={photo} />

        <Button title="Add defect" variant="secondary" size="sm" onPress={addItem} />

        {items.length > 0 ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <AppText variant="meta" style={{ color: colors.muted }}>
              {items.length} defect(s) added
            </AppText>
            {items.map((it) => (
              <View
                key={it.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="meta" style={{ color: colors.fg, fontWeight: '600' }}>
                    {it.displayTitle}
                  </AppText>
                  {it.note ? (
                    <AppText variant="meta" style={{ color: colors.muted }}>
                      {it.note}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                  hitSlop={8}
                >
                  <AppText style={{ color: colors.muted, fontSize: 18 }}>×</AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Button
          title={submitPhase === 'submitting' ? 'Submitting…' : `Submit defects (${items.length})`}
          loading={submitPhase === 'submitting'}
          onPress={submit}
          size="sm"
          disabled={items.length === 0 || submitPhase !== 'idle'}
        />
      </Card>
    </>
  );
}
