'use client';

import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAckAnnouncement, useCondoAnnouncements, useMyCondos } from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';

const TONE: Record<string, 'info' | 'warning' | 'danger'> = {
  INFO: 'info',
  IMPORTANT: 'warning',
  URGENT: 'danger',
};

export default function AnnouncementsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const list = useCondoAnnouncements(api, condo?.id ?? null);
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
          {(list.data?.items as any[])?.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <div className="text-xs sr-muted mt-0.5">
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleString()
                      : new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone={TONE[a.importance] ?? 'info'}>{a.importance.toLowerCase()}</Badge>
              </div>
              <Markdown className="text-sm">{a.body}</Markdown>
              {a.requiresAck ? (
                <div className="mt-4 pt-4 border-t border-[rgb(var(--sr-border))] flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
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
          ))}
        </ul>
      )}
    </div>
  );
}
