'use client';

import { api } from '@/lib/api';
import { RESIDENT_ANNOUNCEMENT_INBOX_PARAMS } from '@/lib/resident-announcements';
import { toast } from '@/lib/toast';
import {
  type AnnouncementSummary,
  useAckAnnouncement,
  useCondoAnnouncements,
  useMyCondos,
} from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';

const IMPORTANCE_TONE: Record<string, 'info' | 'warning' | 'danger'> = {
  INFO: 'info',
  IMPORTANT: 'warning',
  URGENT: 'danger',
};

const CATEGORY_LABEL: Record<string, string> = {
  NOTICE: 'Notice',
  DOCUMENT: 'Document',
  MAINTENANCE: 'Maintenance',
};

export default function AnnouncementsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useCondoAnnouncements(api, condo?.id ?? null, RESIDENT_ANNOUNCEMENT_INBOX_PARAMS);
  const ack = useAckAnnouncement(api);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Announcements</h2>
        <p className="sr-muted">News from your management office.</p>
      </header>
      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Nothing new" description="Announcements will show up here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {list.data?.items.map((a) => (
            <AnnouncementRow
              key={a.id}
              item={a}
              onAck={async () => {
                try {
                  await ack.mutateAsync(a.id);
                  toast.success('Acknowledged');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AnnouncementRow({
  item: a,
  onAck,
}: {
  item: AnnouncementSummary;
  onAck: () => Promise<void>;
}) {
  const pdf = a.attachments?.find((att) => att.mimeType === 'application/pdf');

  return (
    <Card>
      <Link href={`/announcements/${a.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {!a.readAt ? (
              <span
                className="mt-2 size-2 shrink-0 rounded-full bg-[rgb(var(--sr-accent))]"
                aria-label="Unread"
              />
            ) : null}
            <div className="min-w-0">
              <h3 className="font-semibold">{a.title}</h3>
              <div className="text-xs sr-muted mt-0.5">
                {a.publishedAt
                  ? new Date(a.publishedAt).toLocaleString()
                  : new Date(a.createdAt ?? Date.now()).toLocaleString()}
                {a.pinned ? ' · Pinned' : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 justify-end shrink-0">
            <Badge tone="neutral">{CATEGORY_LABEL[a.category] ?? a.category}</Badge>
            <Badge tone={IMPORTANCE_TONE[a.importance] ?? 'info'}>
              {a.importance.toLowerCase()}
            </Badge>
          </div>
        </div>
      </Link>
      {pdf ? (
        <div className="mt-3 text-xs sr-muted">PDF attached · {pdf.fileName ?? 'Document'}</div>
      ) : null}
      {a.requiresAck ? (
        <div className="mt-4 pt-4 border-t border-[rgb(var(--sr-border))] flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => onAck()}>
            Acknowledge
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
