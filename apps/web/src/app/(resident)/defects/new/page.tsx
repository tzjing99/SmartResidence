'use client';

import { DefectSubmissionProgress } from '@/components/defect-submission-progress';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  uploadAttachment,
  useCreateDefect,
  useCreateHandoverReport,
  useMyUnits,
  useUnitHandoverTemplate,
} from '@smartresidence/api-client';
import {
  type CreateDefectInput,
  CreateDefectSchema,
  DEFECT_CATEGORIES,
  type HandoverReportItemInput,
  type HandoverTemplate,
  MAX_ATTACHMENTS_PER_MESSAGE,
  handoverDefectTitle,
} from '@smartresidence/shared-types';
import {
  Button,
  Card,
  Input,
  Label,
  PhotoUpload,
  type PhotoUploadHandle,
  Select,
  Textarea,
  cn,
} from '@smartresidence/ui-web';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

type Mode = 'single' | 'handover';

export default function NewDefectPage() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const [mode, setMode] = React.useState<Mode>('single');

  return (
    <div className="max-w-xl">
      <h2 className="sr-section-title mb-1">Report defects</h2>
      <p className="sr-muted mb-5">
        Log a single issue, or report multiple defects room-by-room in one submission.
      </p>

      <div className="mb-6 inline-flex rounded-xl border border-[rgb(var(--sr-border))] p-1 bg-[rgb(var(--sr-card))]">
        {(
          [
            { id: 'single', label: 'Single defect' },
            { id: 'handover', label: 'Multiple defects' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={cn(
              'px-4 h-9 rounded-lg text-sm font-medium transition-colors',
              mode === tab.id
                ? 'bg-[rgb(var(--sr-coral))] text-[rgb(var(--sr-coral-fg))]'
                : 'sr-muted hover:text-[rgb(var(--sr-fg))]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <SingleDefectForm unitId={unit?.id} />
      ) : (
        <HandoverForm unitId={unit?.id} />
      )}
    </div>
  );
}

function SingleDefectForm({ unitId }: { unitId?: string }) {
  const router = useRouter();
  const create = useCreateDefect(api);
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const photoRef = React.useRef<PhotoUploadHandle>(null);
  const form = useForm<CreateDefectInput>({
    resolver: zodResolver(CreateDefectSchema),
    defaultValues: { unitId: '', severity: 'MEDIUM', category: 'Plumbing' },
  });

  async function onSubmit(values: CreateDefectInput) {
    if (!unitId) return;
    try {
      await create.mutateAsync({
        ...values,
        unitId,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      photoRef.current?.reset();
      toast.success('Defect submitted');
      router.push('/defects');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...form.register('title')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm focus:border-[rgb(var(--sr-coral))] focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30"
            {...form.register('category')}
          >
            {DEFECT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" placeholder="Master bathroom" {...form.register('location')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={6} {...form.register('description')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Photos (optional)</Label>
          <PhotoUpload
            ref={photoRef}
            maxFiles={MAX_ATTACHMENTS_PER_MESSAGE}
            onChange={setAttachmentIds}
            upload={(file, opts) =>
              uploadAttachment(
                api,
                { file, fileName: file.name, contentType: file.type || 'image/jpeg' },
                opts,
              )
            }
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit defect'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface DraftItem extends HandoverReportItemInput {
  key: string;
  displayTitle: string;
}

const NO_ISSUE = '__none__';

function HandoverForm({ unitId }: { unitId?: string }) {
  const router = useRouter();
  const template = useUnitHandoverTemplate(api, unitId ?? null);
  const create = useCreateHandoverReport(api);
  const photoRef = React.useRef<PhotoUploadHandle>(null);

  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [roomIdx, setRoomIdx] = React.useState(0);
  const [elementId, setElementId] = React.useState('');
  const [issueId, setIssueId] = React.useState(NO_ISSUE);
  const [note, setNote] = React.useState('');
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const [submitPhase, setSubmitPhase] = React.useState<'idle' | 'submitting' | 'success'>('idle');

  const data = template.data as HandoverTemplate | undefined;
  const room = data?.spaces[roomIdx];
  const spaceTree = data?.taxonomy.find((s) => s.id === room?.spaceTypeId);
  const elements = spaceTree?.elements ?? [];
  const selectedElement = elements.find((e) => e.id === elementId);
  const issues = selectedElement?.issues ?? [];

  function resetCompose() {
    setElementId('');
    setIssueId(NO_ISSUE);
    setNote('');
    setAttachmentIds([]);
    photoRef.current?.reset();
  }

  function addItem() {
    if (!room) return;
    if (elements.length > 0 && !elementId) {
      toast.error('Pick an element');
      return;
    }
    if (elements.length === 0 && !note.trim()) {
      toast.error('Add a note describing the issue');
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
        elementId: elementId || undefined,
        issueId: issueId !== NO_ISSUE ? issueId : undefined,
        note: note.trim() || undefined,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
        displayTitle,
      },
    ]);
    resetCompose();
  }

  async function submit() {
    if (!unitId || items.length === 0 || submitPhase !== 'idle') return;
    setSubmitPhase('submitting');
    try {
      await create.mutateAsync({
        unitId,
        items: items.map(({ key, displayTitle, ...item }) => item),
      });
      setSubmitPhase('success');
      await new Promise((resolve) => setTimeout(resolve, 900));
      toast.success(`${items.length} defect(s) submitted`);
      router.push('/defects');
    } catch (err) {
      setSubmitPhase('idle');
      toast.error((err as Error).message);
    }
  }

  if (template.isLoading) {
    return <Card>Loading your unit layout…</Card>;
  }

  if (!data || data.spaces.length === 0) {
    return (
      <Card>
        <h3 className="font-semibold mb-1">No unit layout yet</h3>
        <p className="text-sm sr-muted">
          Your unit doesn&apos;t have a type with rooms assigned yet. Please ask building management
          to set your unit type before reporting multiple defects. You can still use the{' '}
          <span className="font-medium">Single defect</span> form above.
        </p>
      </Card>
    );
  }

  const grouped = items.reduce<Record<string, DraftItem[]>>((acc, it) => {
    if (!acc[it.spaceLabel]) acc[it.spaceLabel] = [];
    acc[it.spaceLabel].push(it);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <DefectSubmissionProgress
        visible={submitPhase !== 'idle'}
        itemCount={items.length}
        complete={submitPhase === 'success'}
      />
      <Card>
        <h3 className="font-semibold mb-1 text-sm">Add a defect</h3>
        <p className="text-xs sr-muted mb-4">
          {data.unitTypeName
            ? `Layout: ${data.unitTypeName}`
            : 'Pick a room and the issue you found.'}
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Room</Label>
            <Select
              value={String(roomIdx)}
              onValueChange={(v) => {
                setRoomIdx(Number(v));
                resetCompose();
              }}
              options={data.spaces.map((s, i) => ({ value: String(i), label: s.spaceLabel }))}
              aria-label="Room"
            />
          </div>

          {elements.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Element</Label>
                <Select
                  value={elementId}
                  onValueChange={(v) => {
                    setElementId(v);
                    setIssueId(NO_ISSUE);
                  }}
                  options={[
                    { value: '', label: 'Select…' },
                    ...elements.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  aria-label="Element"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Issue (optional)</Label>
                <Select
                  value={issueId}
                  onValueChange={setIssueId}
                  options={[
                    { value: NO_ISSUE, label: 'General / other' },
                    ...issues.map((i) => ({ value: i.id, label: i.name })),
                  ]}
                  aria-label="Issue"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs sr-muted">
              No checklist configured for this room — describe the issue in the note below.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the contractor should know"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Photos (optional)</Label>
            <PhotoUpload
              ref={photoRef}
              maxFiles={MAX_ATTACHMENTS_PER_MESSAGE}
              onChange={setAttachmentIds}
              upload={(file, opts) =>
                uploadAttachment(
                  api,
                  { file, fileName: file.name, contentType: file.type || 'image/jpeg' },
                  opts,
                )
              }
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="soft-primary" onClick={addItem}>
              Add defect
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            Defects {items.length > 0 ? `(${items.length})` : ''}
          </h3>
        </div>
        {items.length === 0 ? (
          <p className="text-sm sr-muted">
            No items added yet. Build your list room by room above.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([space, list]) => (
              <div key={space}>
                <div className="text-xs font-semibold uppercase sr-muted mb-1.5">
                  {space} · {list.length}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {list.map((it) => (
                    <li
                      key={it.key}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[rgb(var(--sr-border))] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{it.displayTitle}</div>
                        {it.note ? <div className="text-xs sr-muted">{it.note}</div> : null}
                        {it.attachmentIds?.length ? (
                          <div className="text-xs sr-muted">{it.attachmentIds.length} photo(s)</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                        className="shrink-0 text-[rgb(var(--sr-muted))] hover:text-[rgb(var(--sr-coral))]"
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-5">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={items.length === 0 || submitPhase !== 'idle'}
          >
            {submitPhase === 'submitting' ? 'Submitting…' : `Submit defects (${items.length})`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
