'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAckAnnouncement, useAnnouncement } from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';

const IMPORTANCE_TONE: Record<string, 'info' | 'warning' | 'danger'> = {
  INFO: 'info',
  IMPORTANT: 'warning',
  URGENT: 'danger',
};

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useAnnouncement(api, id);
  const ack = useAckAnnouncement(api);

  const openPdf = useCallback(async (attachmentId: string) => {
    try {
      const blob = await api.fetchAttachmentBlob(attachmentId, 'raw');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  if (detail.isLoading || !detail.data) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const a = detail.data;
  const pdf = a.attachments?.find((att) => att.mimeType === 'application/pdf');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/announcements"
        className="inline-flex items-center gap-2 text-sm sr-muted hover:text-[rgb(var(--sr-fg))]"
      >
        <ArrowLeft className="size-4" />
        Back to announcements
      </Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{a.category.toLowerCase()}</Badge>
          <Badge tone={IMPORTANCE_TONE[a.importance] ?? 'info'}>{a.importance.toLowerCase()}</Badge>
          {!a.readAt ? <Badge tone="warning">Unread</Badge> : null}
        </div>
        <h1 className="sr-section-title">{a.title}</h1>
        <p className="text-sm sr-muted">
          {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}
          {a.author?.name ? ` · ${a.author.name}` : ''}
        </p>
      </header>
      <Card>
        <Markdown className="text-sm">{a.body}</Markdown>
        {pdf ? (
          <div className="mt-6 pt-4 border-t border-[rgb(var(--sr-border))]">
            <Button variant="secondary" size="sm" onClick={() => openPdf(pdf.id)}>
              <FileText className="size-4 mr-2" />
              Open PDF{pdf.fileName ? ` (${pdf.fileName})` : ''}
            </Button>
          </div>
        ) : null}
        {a.requiresAck ? (
          <div className="mt-6 pt-4 border-t border-[rgb(var(--sr-border))] flex justify-end">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await ack.mutateAsync(a.id);
                  toast.success('Acknowledged');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              Acknowledge
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
