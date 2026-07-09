'use client';

import { DefectSignOffActions } from '@/components/defect-sign-off';
import {
  DefectActivityFeed,
  DefectPhotos,
  DefectStatusBadge,
  DefectStatusTimeline,
} from '@/components/defect-ui';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  uploadAttachment,
  useAddDefectUpdate,
  useDefect,
  useTransitionDefect,
} from '@smartresidence/api-client';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@smartresidence/shared-types';
import {
  Button,
  Card,
  PhotoUpload,
  type PhotoUploadHandle,
  Skeleton,
  Textarea,
} from '@smartresidence/ui-web';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

export default function ResidentDefectDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const detail = useDefect(api, params.id);
  const addUpdate = useAddDefectUpdate(api);
  const transition = useTransitionDefect(api);
  const d = detail.data as any;

  const [comment, setComment] = React.useState('');
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>([]);
  const photoRef = React.useRef<PhotoUploadHandle>(null);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await addUpdate.mutateAsync({
        id: params.id,
        message: comment.trim(),
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      });
      setComment('');
      setAttachmentIds([]);
      photoRef.current?.reset();
      toast.success(t('defects.commentAddedToast'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function signOff(status: 'CLOSED' | 'REOPENED') {
    try {
      await transition.mutateAsync({ id: params.id, status });
      toast.success(status === 'CLOSED' ? t('defects.signedOffToast') : t('defects.reopenedToast'));
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
          href="/defects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('defects.backToDefects')}
        </Link>
        <p className="sr-muted">This defect could not be found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/defects"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
      >
        <ArrowLeft className="size-4" />
        All defects
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DefectStatusBadge status={d.status} />
        </div>
        <h2 className="sr-section-title">{d.title}</h2>
        <p className="text-sm sr-muted">
          {d.category}
          {d.location ? ` · ${d.location}` : ''} · raised{' '}
          {new Date(d.createdAt).toLocaleDateString()}
          {d.assignedTo?.name ? ` · handled by ${d.assignedTo.name}` : ''}
        </p>
      </header>

      {d.status === 'RESOLVED' ? (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
          <h3 className="font-semibold mb-2 text-sm text-emerald-900 dark:text-emerald-100">
            Ready for your sign-off
          </h3>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-3">
            Management marked this repair as fixed. Please verify the work before signing off.
          </p>
          <DefectSignOffActions
            pending={transition.isPending}
            onSignOff={() => signOff('CLOSED')}
            onReject={() => signOff('REOPENED')}
            hideHint
          />
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="font-semibold mb-2 text-sm">Description</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{d.description}</p>
            {d.attachments?.length ? (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-sm">Photos</h3>
                <DefectPhotos attachments={d.attachments} />
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3 text-sm">Activity</h3>
            <DefectActivityFeed updates={d.updates ?? []} showInternal={false} />

            <form className="mt-4 flex flex-col gap-2.5" onSubmit={submitComment}>
              <Textarea
                rows={3}
                placeholder="Add a comment for the management team…"
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
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={addUpdate.isPending || !comment.trim()}
                  loading={addUpdate.isPending}
                >
                  {t('actions.addComment')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <Card className="h-fit">
          <h3 className="font-semibold mb-3 text-sm">Status timeline</h3>
          <DefectStatusTimeline status={d.status} updates={d.updates ?? []} />
        </Card>
      </div>
    </div>
  );
}
