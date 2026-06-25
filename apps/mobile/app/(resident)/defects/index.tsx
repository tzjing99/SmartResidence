import {
  useCreateDefect,
  useCreateHandoverReport,
  useMyUnits,
  useUnitDefectReports,
  useUnitDefects,
  useUnitHandoverTemplate,
} from '@smartresidence/api-client';
import {
  defectReference,
  handoverDefectTitle,
} from '@smartresidence/shared-types';
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
  EmptyState,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { PhotoPicker } from '../../../src/components/photo-picker';
import { DefectSubmissionProgress } from '../../../src/components/defect-submission-progress';
import {
  RESIDENT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../../src/components/resident-screen';
import { api } from '../../../src/lib/api';
import { usePhotoUpload } from '../../../src/lib/use-photo-upload';

type Mode = 'single' | 'handover';

export default function DefectsScreen() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const defects = useUnitDefects(api, unit?.id ?? null);
  const reports = useUnitDefectReports(api, unit?.id ?? null);
  const [mode, setMode] = useState<Mode>('single');

  const items = [
    ...((reports.data ?? []).map((r) => ({ kind: 'package' as const, data: r }))),
    ...(((defects.data?.items as any[]) ?? []).map((d) => ({ kind: 'defect' as const, data: d }))),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

  return (
    <ResidentScreen
      eyebrow="Defects"
      title="Report a repair"
      subtitle="Send clear details to management and follow each defect until it is resolved."
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title="Single defect"
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
        title="Repair history"
        subtitle="Open and completed reports stay here for reference."
      />

      {items.length === 0 ? (
        <EmptyState title="No defects yet" description="Repairs you submit will track here." />
      ) : (
        items.map((row) =>
          row.kind === 'package' ? (
            <PackageCard key={`package-${row.data.id}`} report={row.data} />
          ) : (
            <Card key={`defect-${row.data.id}`} style={residentStyles.card}>
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
                  <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                    {row.data.title}
                  </AppText>
                  <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
                    {row.data.category} · {new Date(row.data.createdAt).toLocaleDateString()}
                  </AppText>
                </View>
                <Pill
                  tone={
                    row.data.status === 'CLOSED' || row.data.status === 'RESOLVED'
                      ? 'success'
                      : row.data.status === 'NEW'
                        ? 'primary'
                        : 'info'
                  }
                  label={
                    row.data.status === 'RESOLVED'
                      ? 'Waiting sign-off'
                      : prettyLabel(row.data.status)
                  }
                />
              </View>
            </Card>
          ),
        )
      )}
    </ResidentScreen>
  );
}

function PackageCard({ report }: { report: DefectReportSummary }) {
  const router = useRouter();
  const status = reportStatus(report);
  const done = (report.statusCounts.RESOLVED ?? 0) + (report.statusCounts.CLOSED ?? 0);
  const pct = report.itemCount ? Math.round((done / report.itemCount) * 100) : 0;

  return (
    <AnimatedPressable
      onPress={() => router.push(`/(resident)/defects/package/${report.id}` as Href)}
    >
      <Card style={residentStyles.card}>
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
            <AppText style={{ fontWeight: '700', color: palette.textLight }}>Defect Report</AppText>
            <AppText
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: RESIDENT_CORAL,
                marginTop: 2,
              }}
            >
              {defectReference(report.id)}
            </AppText>
            <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
              {report.itemCount} defect(s) · {new Date(report.createdAt).toLocaleDateString()}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: palette.borderLight,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 999,
                    backgroundColor: RESIDENT_CORAL,
                  }}
                />
              </View>
              <AppText variant="meta" style={{ color: palette.mutedLight }}>
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
            label={status === 'RESOLVED' ? 'Waiting sign-off' : prettyLabel(status)}
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
  const create = useCreateDefect(api);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function attach() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission needed');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  }

  async function submit() {
    if (!unitId || !title || !description) {
      Alert.alert('Please fill title and description');
      return;
    }
    try {
      await create.mutateAsync({
        unitId,
        title,
        description,
        category: 'Other',
      });
      setTitle('');
      setDescription('');
      setPhotoUri(null);
    } catch (err) {
      Alert.alert('Could not submit', (err as Error).message);
    }
  }

  return (
    <Card style={[residentStyles.card, { gap: spacing.sm }]}>
      <View style={{ gap: 4 }}>
        <AppText variant="subheading">Submit a defect</AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          A short title and photo help the team route it faster.
        </AppText>
      </View>
      <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={inputStyle} />
      <TextInput
        placeholder="What's wrong?"
        value={description}
        onChangeText={setDescription}
        multiline
        style={[inputStyle, { height: 90, marginTop: 10, textAlignVertical: 'top', paddingTop: 10 }]}
      />
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ height: 140, borderRadius: radius.lg, marginTop: 10 }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          title={photoUri ? 'Retake photo' : 'Take photo'}
          variant="secondary"
          size="sm"
          style={{ flexGrow: 1 }}
          onPress={attach}
        />
        <Button
          title={create.isPending ? 'Submitting…' : 'Submit'}
          loading={create.isPending}
          onPress={submit}
          size="sm"
          style={{ flexGrow: 1 }}
        />
      </View>
    </Card>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.full ?? 999,
        borderWidth: 1,
        borderColor: active ? palette.coralPrimary : palette.borderLight,
        backgroundColor: active ? palette.coralPrimary : palette.surfaceLight,
      }}
    >
      <AppText
        variant="meta"
        style={{ color: active ? '#fff' : palette.textLight, fontWeight: '600' }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

interface DraftItem extends HandoverReportItemInput {
  key: string;
  displayTitle: string;
}

function HandoverComposer({ unitId }: { unitId?: string }) {
  const template = useUnitHandoverTemplate(api, unitId ?? null);
  const create = useCreateHandoverReport(api);
  const photo = usePhotoUpload();

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
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    if (elements.length > 0 && !elementId) {
      Alert.alert('Pick an element');
      return;
    }
    if (elements.length === 0 && !note.trim()) {
      Alert.alert('Add a note describing the issue');
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
      Alert.alert('Submitted', `${count} defect(s) submitted.`);
    } catch (err) {
      setSubmitPhase('idle');
      Alert.alert('Could not submit', (err as Error).message);
    }
  }

  if (template.isLoading) {
    return (
      <Card style={residentStyles.card}>
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading your unit layout…
        </AppText>
      </Card>
    );
  }

  if (!data || data.spaces.length === 0) {
    return (
      <Card style={residentStyles.card}>
        <AppText variant="subheading">No unit layout yet</AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 4 }}>
          Your unit doesn&apos;t have a type with rooms assigned. Ask management to set your unit type
          before reporting multiple defects.
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
      <Card style={[residentStyles.card, { gap: spacing.sm }]}>
        <View style={{ gap: 4 }}>
          <AppText variant="subheading">Multiple defects</AppText>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
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
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            No checklist for this room — describe the issue in the note.
          </AppText>
        )}

        <TextInput
          placeholder="Note (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          style={[inputStyle, { height: 70, marginTop: 4, textAlignVertical: 'top', paddingTop: 10 }]}
        />

        <PhotoPicker controller={photo} />

        <Button title="Add defect" variant="secondary" size="sm" onPress={addItem} />

        {items.length > 0 ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <AppText variant="meta" style={{ color: palette.mutedLight }}>
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
                  borderColor: palette.borderLight,
                  borderRadius: radius.md,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="meta" style={{ color: palette.textLight, fontWeight: '600' }}>
                    {it.displayTitle}
                  </AppText>
                  {it.note ? (
                    <AppText variant="meta" style={{ color: palette.mutedLight }}>
                      {it.note}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                  hitSlop={8}
                >
                  <AppText style={{ color: palette.mutedLight, fontSize: 18 }}>×</AppText>
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

const chipLabel = { color: palette.mutedLight, marginTop: 6, marginBottom: 2 } as const;

const inputStyle = {
  minHeight: 46,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  backgroundColor: palette.surfaceLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
