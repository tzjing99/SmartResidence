'use client';

import { useMyActivity } from '@smartresidence/api-client';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { api } from '@/lib/api';

export default function ActivityPage() {
  const activity = useMyActivity(api);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Activity on my unit</h2>
        <p className="sr-muted">
          Every action that touches your unit is logged here. No silent admin moves.
        </p>
      </header>
      {activity.isLoading ? (
        <Skeleton className="h-32" />
      ) : (activity.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Nothing yet" description="Activity will appear as it happens." />
      ) : (
        <ul className="flex flex-col gap-2">
          {(activity.data?.items as any[])?.map((row) => (
            <Card key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {row.action} · {row.resourceType}
                  </div>
                  <div className="text-xs sr-muted mt-0.5">
                    {row.actor?.name ?? 'System'}
                    {row.actorRole ? ` · ${row.actorRole.replace('_', ' ')}` : ''}
                    {' · '}
                    {new Date(row.createdAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone="neutral">{row.action.toLowerCase()}</Badge>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
