'use client';

import { api } from '@/lib/api';
import {
  useMyUnits,
  useRegenerateVisitorCode,
  useUnitVisitors,
  useVisitorQr,
} from '@smartresidence/api-client';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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

          {visitor.accessCode ? (
            <Card className="text-center py-8">
              <p className="text-xs uppercase tracking-widest sr-muted mb-2">Access code</p>
              <p className="font-mono text-4xl font-bold tracking-[0.3em]">{visitor.accessCode}</p>
              <p className="text-xs sr-muted mt-3">
                Tell the guard this code or show the QR below.
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
            <Button variant="outline" onClick={onRegenerate} disabled={regenerate.isPending}>
              <RefreshCw className="size-4" />
              {regenerate.isPending ? 'Generating…' : 'Regenerate code'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
