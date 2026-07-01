'use client';

import {
  DefectActivityFeed,
  DefectPhotos,
  DefectStatusBadge,
  DefectStatusTimeline,
} from '@/components/defect-ui';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useAddDefectUpdate,
  useDefect,
  useSlaSettings,
  useTransitionDefect,
} from '@smartresidence/api-client';
import {
  DEFECT_STATUS_LABELS,
  type DefectStatus,
  MAX_ATTACHMENTS_PER_MESSAGE,
  nextDefectStatuses,
} from '@smartresidence/shared-types';
import {
  Button,
  Card,
  PhotoUpload,
  type PhotoUploadHandle,
  Select,
  Skeleton,
  Textarea,
} from '@smartresidence/ui-web';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

const UNASSIGNED = '__unassigned__';

export default function AdminDefectDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useDefect(api, params.id);
  const d = detail.data as any;
  const sla = useSlaSettings(api, d?.condoId ?? null);
  const transition = useTransitionDefect(api);
  const addUpdate = useAddDefectUpdate(api);

  const [assignee, setAssignee] = React.useState<string>(UNASSIGNED);
  const [transitionNote, setTransitionNote] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const photoRef = React.useRef<PhotoUploadHandle>(null);

  React.useEffect(() => {
    if (d?.assignedToUserId) setAssignee(d.assignedToUserId);
  }, [d?.assignedToUserId]);

  const staff = (sla.data?.managementStaff ?? []) as Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
  const staffOptions = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...staff.map((s) => ({ value: s.id, label: s.name || s.email || s.id })),
  ];

  async function move(status: DefectStatus) {
    try {
      const assignedToUserId =
        assignee !== UNASSIGNED && assignee !== d.assignedToUserId ? assignee : undefined;
      await transition.mutateAsync({
        id: params.id,
        status,
        message: transitionNote.trim() || undefined,
        assignedToUserId,
      });
      setTransitionNote('');
      toast.success(`Moved to ${DEFECT_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await addUpdate.mutateAsync({
        id: params.id,
        message: comment.trim(),
        isInternal: internal,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      setComment('');
      setAttachmentIds([]);
      setInternal(false);
      photoRef.current?.reset();
      toast.success('Comment added');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!d) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/defects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to defect board
        </Link>
        <p className="sr-muted">This defect could not be found.</p>
      </div>
    );
  }

  const transitions = nextDefectStatuses(d.status as DefectStatus);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/defects"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
      >
        <ArrowLeft className="size-4" />
        Defects
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DefectStatusBadge status={d.status} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{d.title}</h1>
        <p className="text-sm sr-muted">
          {d.unit?.identifier ?? '—'} · {d.category}
          {d.location ? ` · ${d.location}` : ''} · raised by {d.raisedBy?.name ?? 'resident'} on{' '}
          {new Date(d.createdAt).toLocaleDateString()}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="font-semibold mb-2 text-sm">Description</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{d.description}</p>
            {d.attachments?.length ? (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-sm">Resident photos</h3>
                <DefectPhotos attachments={d.attachments} />
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3 text-sm">Activity & internal notes</h3>
            <DefectActivityFeed updates={d.updates ?? []} showInternal />

            <form className="mt-4 flex flex-col gap-2.5" onSubmit={submitComment}>
              <Textarea
                rows={3}
                placeholder={
                  internal
                    ? 'Internal note (not visible to the resident)…'
                    : 'Reply to the resident…'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
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
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm sr-muted">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="size-4 rounded border-[rgb(var(--sr-border))]"
                  />
                  Internal note
                </label>
                <Button type="submit" disabled={addUpdate.isPending || !comment.trim()}>
                  {addUpdate.isPending ? 'Sending…' : 'Post'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="h-fit">
            <h3 className="font-semibold mb-3 text-sm">Manage</h3>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium sr-muted">Assign to</span>
              <Select
                value={assignee}
                onValueChange={setAssignee}
                options={staffOptions}
                aria-label="Assign defect"
              />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-medium sr-muted">Note for this change (optional)</span>
              <Textarea
                rows={2}
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="e.g. Contractor scheduled for Friday"
              />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-medium sr-muted">Move to</span>
              {transitions.length === 0 ? (
                <p className="text-sm sr-muted">No further actions available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {transitions.map((next) => (
                    <Button
                      key={next}
                      variant="secondary"
                      onClick={() => move(next)}
                      disabled={transition.isPending}
                    >
                      {DEFECT_STATUS_LABELS[next]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="h-fit">
            <h3 className="font-semibold mb-3 text-sm">Status timeline</h3>
            <DefectStatusTimeline status={d.status} updates={d.updates ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}
