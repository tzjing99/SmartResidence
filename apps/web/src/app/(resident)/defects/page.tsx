'use client';

import Link from 'next/link';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useMyUnits, useUnitDefects } from '@smartresidence/api-client';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';

const SEVERITY_TONE: Record<string, 'neutral' | 'primary' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

export default function DefectsPage() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const defects = useUnitDefects(api, unit?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="sr-section-title">Defects</h2>
          <p className="sr-muted">Track repairs from submission to resolution.</p>
        </div>
        <Link href="/defects/new">
          <Button>
            <Plus className="size-4" />
            New defect
          </Button>
        </Link>
      </header>

      {defects.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (defects.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No defects reported"
          description="If something needs fixing, log it here with a photo."
          action={
            <Link href="/defects/new">
              <Button>Submit a defect</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {(defects.data?.items as any[])?.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs sr-muted mt-0.5">
                    {d.category} · raised {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge tone={SEVERITY_TONE[d.severity] ?? 'neutral'}>
                    {d.severity.toLowerCase()}
                  </Badge>
                  <Badge tone={d.status === 'CLOSED' || d.status === 'RESOLVED' ? 'success' : 'primary'}>
                    {d.status.toLowerCase().replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
