'use client';
import { api } from '@/lib/api';
import {
  useApproveVisitor,
  useMyUnits,
  useRejectVisitor,
  useUnitVisitors,
} from '@smartresidence/api-client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4'];

export default function VisitorsPage() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const approve = useApproveVisitor(api);
  const reject = useRejectVisitor(api);

  async function onApprove(id: string) {
    try {
      await approve.mutateAsync(id);
      toast.success('Visitor approved — guard may check them in');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onReject(id: string) {
    try {
      await reject.mutateAsync({ visitorId: id });
      toast.success('Visitor rejected');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

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
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-20" />
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
                <div className="flex-1">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs sr-muted mt-0.5">
                    {v.visitType === 'WALKIN_UNIT' ? 'Walk-in · ' : ''}
                    Expected {new Date(v.expectedAt).toLocaleString()}
                    {v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}
                    {v.purpose ? ` · ${v.purpose}` : ''}
                  </div>
                  {v.accessCode ? (
                    <Link href={`/visitors/${v.id}`} className="block mt-2">
                      <span className="font-mono text-lg font-semibold tracking-widest hover:underline">
                        {v.accessCode}
                      </span>
                    </Link>
                  ) : null}
                  {v.status === 'PENDING_OWNER_APPROVAL' ? (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => onApprove(v.id)}
                        disabled={approve.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(v.id)}
                        disabled={reject.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : v.visitType === 'PRE_REG' && v.status === 'APPROVED' ? (
                    <Link
                      href={`/visitors/${v.id}`}
                      className="text-sm text-coral-500 hover:underline mt-2 inline-block"
                    >
                      View pass →
                    </Link>
                  ) : null}
                </div>
                <Badge tone={statusTone(v.status)}>
                  {v.status.toLowerCase().replace(/_/g, ' ')}
                </Badge>
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
    case 'PENDING_OWNER_APPROVAL':
      return 'warning' as const;
    default:
      return 'primary' as const;
  }
}
