'use client';

import { api } from '@/lib/api';
import { useWhoViewedMe } from '@smartresidence/api-client';
import { Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Eye } from 'lucide-react';

export default function WhoViewedPage() {
  const data = useWhoViewedMe(api);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Who viewed my data</h2>
        <p className="sr-muted">
          Which staff opened your unit's records, and when. Disagree with one? Reach out to your
          management office or report it via the platform's audit trail.
        </p>
      </header>
      {data.isLoading ? (
        <Skeleton className="h-40" />
      ) : (data.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Eye className="size-6" />}
          title="No views recorded"
          description="When management staff open your records, you'll see it here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(data.data?.items as any[])?.map((row) => (
            <Card key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {row.actor?.name ?? 'Unknown actor'} viewed {row.resourceType}
                  </div>
                  <div className="text-xs sr-muted mt-0.5">
                    {row.actorRole ? `${row.actorRole.replace('_', ' ')} · ` : ''}
                    {new Date(row.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
