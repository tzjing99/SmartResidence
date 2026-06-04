'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMyUnits, useUnitVisitors } from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';

export default function VisitorsPage() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="sr-section-title">Visitors</h2>
          <p className="sr-muted">Pre-register guests so they walk straight through.</p>
        </div>
        <Link href="/visitors/new">
          <Button>
            <Plus className="size-4" />
            Pre-register
          </Button>
        </Link>
      </section>

      {visitors.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (visitors.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No visitors yet"
          description="Your past and upcoming visitors will appear here."
          action={
            <Link href="/visitors/new">
              <Button>Pre-register a visitor</Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {(visitors.data?.items as any[])?.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs sr-muted mt-0.5">
                    Expected {new Date(v.expectedAt).toLocaleString()}
                    {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                    {v.purpose ? ` · ${v.purpose}` : ''}
                  </div>
                </div>
                <Badge tone={statusTone(v.status)}>{v.status.toLowerCase().replace('_', ' ')}</Badge>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusTone(status: string) {
  switch (status) {
    case 'CHECKED_IN':
      return 'success' as const;
    case 'CHECKED_OUT':
      return 'neutral' as const;
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXPIRED':
      return 'danger' as const;
    case 'APPROVED':
    default:
      return 'primary' as const;
  }
}
