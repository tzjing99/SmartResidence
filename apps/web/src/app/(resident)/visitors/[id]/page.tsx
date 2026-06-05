'use client';

import { api } from '@/lib/api';
import {
  useMyUnits,
  useRegenerateVisitorCode,
  useUnitVisitors,
  useVisitorQr,
} from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function VisitorPassPage() {
  const params = useParams<{ id: string }>();
  const visitorId = params.id;
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const qr = useVisitorQr(api, visitorId);
  const regenerate = useRegenerateVisitorCode(api);

  const visitor = (visitors.data?.items as any[] | undefined)?.find((v) => v.id === visitorId);

  async function onRegenerate() {
    try {
      await regenerate.mutateAsync(visitorId);
      await qr.refetch();
      toast.success('New access code generated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <Link
        href="/visitors"
        className="inline-flex items-center gap-2 text-sm sr-muted hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to visitors
      </Link>

      {!visitor ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <header>
            <h2 className="sr-section-title">{visitor.name}</h2>
            <p className="sr-muted text-sm mt-1">
              Expected {new Date(visitor.expectedAt).toLocaleString()}
            </p>
            <Badge tone={visitor.status === 'APPROVED' ? 'primary' : 'neutral'} className="mt-2">
              {visitor.status.toLowerCase().replace(/_/g, ' ')}
            </Badge>
          </header>

          {visitor.status === 'PENDING_MANAGEMENT_APPROVAL' ? (
            <Card className="flex gap-3 border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <p className="text-sm">
                {visitor.urgentOvernight
                  ? 'Urgent overnight — please visit the management office before your guest arrives. Management will issue the pass after review.'
                  : 'Submitted for management approval. You will receive the access code once approved (within 1 working day).'}
              </p>
            </Card>
          ) : null}

          {visitor.pendingManagementReview && visitor.status === 'APPROVED' ? (
            <Card className="flex gap-3 border-[rgb(var(--sr-primary)/0.25)] bg-[rgb(var(--sr-primary)/0.05)] p-4">
              <AlertTriangle className="size-5 shrink-0 text-[rgb(var(--sr-primary))]" />
              <p className="text-sm">
                Auto-approved for tonight. Management will review this overnight stay on the next
                working day. Your pass is valid from the expected arrival time.
              </p>
            </Card>
          ) : null}

          {visitor.accessCode ? (
            <Card className="text-center py-8">
              <p className="text-xs uppercase tracking-widest sr-muted mb-2">Access code</p>
              <p className="font-mono text-4xl font-bold tracking-[0.3em]">{visitor.accessCode}</p>
              <p className="text-xs sr-muted mt-3">
                {visitor.overnight
                  ? 'Active from expected arrival time. Tell the guard this code or show the QR below.'
                  : 'Tell the guard this code or show the QR below.'}
              </p>
            </Card>
          ) : null}

          {qr.isLoading ? (
            <Skeleton className="h-64" />
          ) : qr.data?.png ? (
            <Card className="flex flex-col items-center gap-3 py-6">
              <Image src={qr.data.png} alt="Visitor QR pass" width={256} height={256} unoptimized />
              <p className="text-xs sr-muted">Scan at the guardhouse</p>
            </Card>
          ) : null}

          {visitor.status === 'APPROVED' && visitor.visitType === 'PRE_REG' ? (
            <Button variant="secondary" onClick={onRegenerate} disabled={regenerate.isPending}>
              <RefreshCw className="size-4" />
              {regenerate.isPending ? 'Generating…' : 'Regenerate code'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
