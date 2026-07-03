import {
  useCreateFormSubmission,
  useFormTemplates,
  useMyCondos,
  useMyFormSubmissions,
  useMyUnits,
} from '@smartresidence/api-client';
import type {
  FormFieldDefinition,
  FormSubmission,
  FormSubmissionStatus,
  FormTemplate,
} from '@smartresidence/shared-types';
import {
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_TEMPLATE_KIND_LABELS,
} from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  EmptyState,
  FadeInView,
  Pill,
  SkeletonList,
  palette,
} from '@smartresidence/ui-mobile';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import {
  RESIDENT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

const STATUS_TONE: Record<FormSubmissionStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <AppText style={{ flex: 1 }}>{field.label}</AppText>
        <Switch
          value={value === true}
          onValueChange={onChange}
          trackColor={{ true: RESIDENT_CORAL }}
        />
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{field.label}</AppText>
      {field.type === 'select' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(field.options ?? []).map((opt) => (
              <Pressable key={opt} onPress={() => onChange(opt)}>
                <Pill tone={value === opt ? 'success' : 'neutral'} label={opt} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#E8DDD8',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: '#fff',
          }}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          multiline={field.type === 'textarea'}
          numberOfLines={field.type === 'textarea' ? 3 : 1}
          onChangeText={(text) => onChange(text)}
        />
      )}
    </View>
  );
}

function SubmitPanel({
  template,
  unitId,
  onBack,
}: { template: FormTemplate; unitId: string; onBack: () => void }) {
  const create = useCreateFormSubmission(api);
  const fields = template.fields?.fields ?? [];
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const submit = () => {
    Alert.alert('Submit form?', 'Management will review your submission.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          try {
            await create.mutateAsync({
              templateId: template.id,
              unitId,
              answers,
              submit: true,
            });
            hapticSuccess();
            Alert.alert('Submitted', 'Your form is awaiting management review.');
            onBack();
          } catch (err) {
            hapticError();
            Alert.alert('Could not submit', (err as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 16 }}>
      <ResidentSectionHeader
        title={template.title}
        subtitle={FORM_TEMPLATE_KIND_LABELS[template.kind]}
      />
      <Card style={[residentStyles.card, { gap: 14 }]}>
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
          />
        ))}
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Back" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <Button title="Submit" onPress={submit} loading={create.isPending} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export default function FormsScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const units = useMyUnits(api);
  const unit = useMemo(
    () => (units.data?.[0] as { id: string; identifier: string } | undefined) ?? null,
    [units.data],
  );
  const templatesQuery = useFormTemplates(api, condo?.id ?? null);
  const submissionsQuery = useMyFormSubmissions(api);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { refreshControl } = usePullToRefresh(
    useCallback(
      () =>
        Promise.all([templatesQuery.refetch(), submissionsQuery.refetch()]).then(() => undefined),
      [submissionsQuery, templatesQuery],
    ),
  );

  const templates = (templatesQuery.data ?? []) as FormTemplate[];
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const myItems = (submissionsQuery.data?.items ?? []) as FormSubmission[];

  if (!unit) {
    return (
      <ResidentScreen eyebrow="Services" title="Forms" subtitle="Condo management forms">
        <EmptyState
          title="No unit linked"
          description="Your account needs a unit to submit forms."
        />
      </ResidentScreen>
    );
  }

  if (selected) {
    return (
      <ResidentScreen
        eyebrow="Services"
        title="Forms"
        scrollProps={{ refreshControl }}
        headerAction={
          <Button
            title="← Back"
            size="sm"
            variant="secondary"
            onPress={() => setSelectedId(null)}
          />
        }
      >
        <SubmitPanel template={selected} unitId={unit.id} onBack={() => setSelectedId(null)} />
      </ResidentScreen>
    );
  }

  return (
    <ResidentScreen
      eyebrow="Services"
      title="Forms"
      subtitle="Move-in/out, renovation permits, and vehicle sticker requests."
      scrollProps={{ refreshControl }}
    >
      <ResidentSectionHeader title="Available forms" />
      {templatesQuery.isLoading ? (
        <SkeletonList rows={3} rowHeight={64} />
      ) : templates.length === 0 ? (
        <EmptyState title="No forms" description="Management has not published any forms yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {templates.map((t, index) => (
            <FadeInView key={t.id} index={index}>
              <AnimatedPressable onPress={() => setSelectedId(t.id)}>
                <Card style={[residentStyles.card, { gap: 4 }]}>
                  <AppText style={{ fontWeight: '700', color: palette.textLight }}>
                    {t.title}
                  </AppText>
                  <AppText variant="meta" style={{ color: palette.mutedLight }}>
                    {FORM_TEMPLATE_KIND_LABELS[t.kind]}
                  </AppText>
                </Card>
              </AnimatedPressable>
            </FadeInView>
          ))}
        </View>
      )}

      <ResidentSectionHeader title="My submissions" />
      {submissionsQuery.isLoading ? (
        <SkeletonList rows={2} rowHeight={80} />
      ) : myItems.length === 0 ? (
        <EmptyState title="No submissions yet" />
      ) : (
        <View style={{ gap: 10 }}>
          {myItems.map((s, index) => (
            <FadeInView key={s.id} index={index}>
              <Card style={[residentStyles.card, { gap: 8 }]}>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                >
                  <AppText style={{ fontWeight: '700', color: palette.textLight }}>
                    {s.template?.title ?? 'Form'}
                  </AppText>
                  <Pill
                    tone={STATUS_TONE[s.status]}
                    label={FORM_SUBMISSION_STATUS_LABELS[s.status]}
                  />
                </View>
                <AppText variant="meta" style={{ color: palette.mutedLight }}>
                  {s.unit?.identifier} · {fmtDate(s.submittedAt ?? s.createdAt)}
                </AppText>
                {s.reviewNote ? (
                  <AppText variant="bodySm" style={{ color: RESIDENT_CORAL }}>
                    {s.reviewNote}
                  </AppText>
                ) : null}
              </Card>
            </FadeInView>
          ))}
        </View>
      )}
    </ResidentScreen>
  );
}
