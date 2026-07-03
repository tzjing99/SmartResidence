'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useApproveFormSubmission,
  useCondoFormSubmissions,
  useFormTemplates,
  useMyCondos,
  useRejectFormSubmission,
  useUpdateFormTemplate,
} from '@smartresidence/api-client';
import type {
  FormSubmission,
  FormSubmissionStatus,
  FormTemplate,
} from '@smartresidence/shared-types';
import {
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_TEMPLATE_KIND_LABELS,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { ClipboardList } from 'lucide-react';
import * as React from 'react';

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

function formatAnswer(value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function SubmissionQueue({ condoId }: { condoId: string }) {
  const [statusFilter, setStatusFilter] = React.useState<string>('SUBMITTED');
  const queue = useCondoFormSubmissions(api, condoId, {
    status: statusFilter || undefined,
  });
  const approve = useApproveFormSubmission(api);
  const reject = useRejectFormSubmission(api);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectNote, setRejectNote] = React.useState('');

  const items = (queue.data?.items ?? []) as FormSubmission[];

  const doApprove = async (id: string) => {
    if (!window.confirm('Approve this submission?')) return;
    try {
      await approve.mutateAsync(id);
      toast.success('Form approved — resident notified');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doReject = async () => {
    if (!rejectId) return;
    try {
      await reject.mutateAsync({ id: rejectId, reviewNote: rejectNote.trim() || undefined });
      toast.success('Form rejected — resident notified');
      setRejectId(null);
      setRejectNote('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Submission queue</h2>
        <select
          className="sr-select w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="SUBMITTED">Awaiting review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {queue.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No submissions"
          description="Submitted forms will appear here for review."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((s) => {
            const fields = s.template?.fields?.fields ?? [];
            const answers = (s.answers ?? {}) as Record<string, unknown>;
            return (
              <Card key={s.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{s.template?.title ?? 'Form'}</div>
                    <div className="text-sm sr-muted">
                      {s.user?.name} · {s.unit?.identifier} · {fmtDate(s.submittedAt)}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[s.status]}>
                    {FORM_SUBMISSION_STATUS_LABELS[s.status]}
                  </Badge>
                </div>
                <dl className="grid sm:grid-cols-2 gap-2 text-sm">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <dt className="sr-muted">{f.label}</dt>
                      <dd className="font-medium">{formatAnswer(answers[f.id])}</dd>
                    </div>
                  ))}
                </dl>
                {s.status === 'SUBMITTED' ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => doApprove(s.id)} disabled={approve.isPending}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRejectId(s.id)}>
                      Reject
                    </Button>
                  </div>
                ) : s.reviewNote ? (
                  <p className="text-sm text-red-600">Note: {s.reviewNote}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {rejectId ? (
        <Card className="p-5 space-y-3 border-red-200">
          <h3 className="font-medium">Reject submission</h3>
          <div>
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Input
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Explain why this was declined"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button onClick={doReject} loading={reject.isPending}>
              Confirm reject
            </Button>
          </div>
        </Card>
      ) : null}
    </section>
  );
}

function TemplateSettings({ condoId }: { condoId: string }) {
  const templates = useFormTemplates(api, condoId, { includeInactive: true });
  const update = useUpdateFormTemplate(api);
  const list = (templates.data ?? []) as FormTemplate[];

  const toggleActive = async (t: FormTemplate) => {
    try {
      await update.mutateAsync({ id: t.id, data: { active: !t.active } });
      toast.success(t.active ? 'Form hidden from residents' : 'Form published');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Form templates</h2>
      <p className="text-sm sr-muted">
        Default MY condo forms are created automatically. Toggle visibility or edit titles in the
        API for custom fields.
      </p>
      {templates.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-3">
          {list.map((t) => (
            <Card key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-sm sr-muted">
                  {FORM_TEMPLATE_KIND_LABELS[t.kind]} · {t.fields?.fields?.length ?? 0} fields
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={t.active ? 'success' : 'neutral'}>
                  {t.active ? 'Active' : 'Hidden'}
                </Badge>
                <Button size="sm" variant="secondary" onClick={() => toggleActive(t)}>
                  {t.active ? 'Hide' : 'Publish'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminFormsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];

  if (!condo) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="size-6" /> Forms
        </h1>
        <EmptyState title="No condo selected" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="size-6" /> Forms
        </h1>
        <p className="text-sm sr-muted mt-1">
          Review resident submissions for move-in/out, renovation permits, and vehicle stickers.
        </p>
      </div>
      <SubmissionQueue condoId={condo.id} />
      <TemplateSettings condoId={condo.id} />
    </div>
  );
}
