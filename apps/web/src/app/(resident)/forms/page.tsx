'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useRoleGuard } from '@/lib/use-role-guard';
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
import { Badge, Button, Card, EmptyState, Label, Skeleton } from '@smartresidence/ui-web';
import { ChevronRight, ClipboardList } from 'lucide-react';
import * as React from 'react';

const STATUS_TONE: Record<FormSubmissionStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

const selectCls = 'sr-select';

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `field-${field.id}`;
  if (field.type === 'boolean') {
    return (
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          id={id}
          type="checkbox"
          className="mt-1"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div>
        <Label htmlFor={id}>{field.label}</Label>
        <textarea
          id={id}
          className={`${selectCls} min-h-[88px]`}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div>
        <Label htmlFor={id}>{field.label}</Label>
        <select
          id={id}
          className={selectCls}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      <Label htmlFor={id}>{field.label}</Label>
      <input
        id={id}
        type={field.type === 'date' ? 'date' : 'text'}
        className={selectCls}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SubmitPanel({
  template,
  unitId,
  onDone,
}: {
  template: FormTemplate;
  unitId: string;
  onDone: () => void;
}) {
  const create = useCreateFormSubmission(api);
  const fields = template.fields?.fields ?? [];
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});

  const setAnswer = (id: string, value: unknown) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const submit = async () => {
    try {
      await create.mutateAsync({
        templateId: template.id,
        unitId,
        answers,
        submit: true,
      });
      toast.success('Form submitted — management will review it shortly');
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{template.title}</h2>
        <p className="text-sm sr-muted">{FORM_TEMPLATE_KIND_LABELS[template.kind]}</p>
      </div>
      <div className="space-y-4">
        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(v) => setAnswer(field.id, v)}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Back
        </Button>
        <Button type="button" onClick={submit} loading={create.isPending}>
          Submit for review
        </Button>
      </div>
    </Card>
  );
}

export default function ResidentFormsPage() {
  useRoleGuard('resident');
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const units = useMyUnits(api);
  const unit = (units.data?.[0] as { id: string; identifier: string } | undefined) ?? null;
  const templates = useFormTemplates(api, condo?.id ?? null);
  const submissions = useMyFormSubmissions(api);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const templateList = (templates.data ?? []) as FormTemplate[];
  const selected = templateList.find((t) => t.id === selectedId) ?? null;
  const myItems = (submissions.data?.items ?? []) as FormSubmission[];

  if (!condo || !unit) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Forms</h1>
        <EmptyState
          title="No unit linked"
          description="Your account needs a unit to submit forms."
        />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="sr-section-title">{selected.title}</h2>
          <p className="sr-muted text-sm mt-1">{FORM_TEMPLATE_KIND_LABELS[selected.kind]}</p>
        </div>
        <SubmitPanel template={selected} unitId={unit.id} onDone={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="sr-section-title">Forms</h2>
        <p className="sr-muted mt-1">
          Submit move-in/out, renovation, and vehicle sticker requests to management — no paperwork
          needed.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Available forms</h3>
        {templates.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : templateList.length === 0 ? (
          <EmptyState
            title="No forms available"
            description="When management publishes forms for your building, they'll appear here."
          />
        ) : (
          <div className="grid gap-3">
            {templateList.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className="text-left"
              >
                <Card className="p-4 flex items-center justify-between gap-3 hover:border-coral-300 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList className="size-5 shrink-0 text-coral-500" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-sm sr-muted">{FORM_TEMPLATE_KIND_LABELS[t.kind]}</div>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 sr-muted" />
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">My submissions</h3>
        {submissions.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : myItems.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Forms you submit will show up here with their review status."
          />
        ) : (
          <div className="grid gap-3">
            {myItems.map((s) => (
              <Card key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{s.template?.title ?? 'Form'}</div>
                  <div className="text-sm sr-muted">
                    {s.unit?.identifier} · {fmtDate(s.submittedAt ?? s.createdAt)}
                  </div>
                  {s.reviewNote ? (
                    <p className="text-sm mt-1 text-red-600">{s.reviewNote}</p>
                  ) : null}
                </div>
                <Badge tone={STATUS_TONE[s.status]}>
                  {FORM_SUBMISSION_STATUS_LABELS[s.status]}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
