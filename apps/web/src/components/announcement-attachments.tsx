'use client';

import { AuthImage } from '@/components/auth-image';
import { api } from '@/lib/api';
import type { AnnouncementAttachment } from '@smartresidence/shared-types';
import { isPdfMime } from '@smartresidence/shared-types';
import { cn } from '@smartresidence/ui-web';
import { FileText, Loader2 } from 'lucide-react';
import * as React from 'react';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfMemoCard({ attachment }: { attachment: AnnouncementAttachment }) {
  const [loading, setLoading] = React.useState(false);

  async function openMemo() {
    setLoading(true);
    try {
      const blob = await api.fetchAttachmentBlob(attachment.id, 'raw');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openMemo}
      disabled={loading}
      className="flex w-full items-center gap-4 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/60 px-4 py-4 text-left transition-colors hover:border-[rgb(var(--sr-coral)/0.35)] hover:bg-[rgb(var(--sr-coral)/0.04)]"
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[rgb(var(--sr-coral)/0.1)] text-[rgb(var(--sr-coral))]">
        {loading ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">Official memo (PDF)</div>
        <div className="sr-muted text-xs mt-0.5 truncate">
          {attachment.fileName ?? 'management-memo.pdf'} · {formatBytes(attachment.size)}
        </div>
        <div className="text-xs text-[rgb(var(--sr-coral))] mt-1 font-medium">
          Tap to view full document
        </div>
      </div>
    </button>
  );
}

export function AnnouncementAttachments({
  attachments,
  className,
}: {
  attachments: AnnouncementAttachment[];
  className?: string;
}) {
  if (!attachments.length) return null;

  const pdfs = attachments.filter((a) => isPdfMime(a.mimeType));
  const images = attachments.filter((a) => !isPdfMime(a.mimeType));

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {pdfs.map((a) => (
        <PdfMemoCard key={a.id} attachment={a} />
      ))}
      {images.length > 0 ? (
        <div
          className={cn(
            'grid gap-2',
            images.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1',
          )}
        >
          {images.map((a) => (
            <AuthImage
              key={a.id}
              attachmentId={a.id}
              variant={images.length === 1 ? 'raw' : 'thumb'}
              alt={a.fileName ?? 'Announcement photo'}
              className="aspect-[4/3] w-full rounded-xl"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
