'use client';

import { api } from '@/lib/api';
import {
  copyVisitorAccessCode,
  downloadVisitorQrPng,
  shareVisitorPass,
} from '@/lib/visitor-pass-share';
import { useMyUnits, useUnitVisitors, useVisitorQr } from '@smartresidence/api-client';
import type { Visitor } from '@smartresidence/shared-types';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import { AlertTriangle, ArrowLeft, Copy, Download, Share2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function VisitorPassPage() {
  const params = useParams<{ id: string }>();
  const visitorId = params.id;
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const qr = useVisitorQr(api, visitorId);
  const [shareFallbackOpen, setShareFallbackOpen] = useState(false);

  const visitor = (visitors.data?.items as Visitor[] | undefined)?.find((v) => v.id === visitorId);
  const canShare =
    visitor?.status === 'APPROVED' &&
    visitor.visitType === 'PRE_REG' &&
    Boolean(visitor.accessCode);

  async function onShare() {
    if (!visitor?.accessCode) return;
    const result = await shareVisitorPass({
      visitorName: visitor.name,
      accessCode: visitor.accessCode,
      expectedAt: new Date(visitor.expectedAt),
      expiresAt: visitor.expiresAt ? new Date(visitor.expiresAt) : null,
      unitIdentifier: unit?.identifier,
      qrPngDataUrl: qr.data?.png,
    });
    if (result === 'shared') {
      toast.success('Pass shared');
      return;
    }
    try {
      await copyVisitorAccessCode(visitor.accessCode);
      toast.success('Access code copied — share the QR below');
    } catch {
      toast.message('Copy the code or download the QR to share');
    }
    setShareFallbackOpen(true);
  }

  async function onCopyCode() {
    if (!visitor?.accessCode) return;
    try {
      await copyVisitorAccessCode(visitor.accessCode);
      toast.success('Access code copied');
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

          {canShare ? (
            <div className="flex flex-col gap-3 pt-2">
              <Button size="lg" className="w-full" onClick={onShare}>
                <Share2 className="size-4" />
                Share pass
              </Button>
              <button
                type="button"
                onClick={onCopyCode}
                className="text-sm text-[rgb(var(--sr-coral))] hover:underline self-center inline-flex items-center gap-1.5"
              >
                <Copy className="size-3.5" />
                Copy code only
              </button>
            </div>
          ) : null}
        </>
      )}

      {shareFallbackOpen && visitor?.accessCode && qr.data?.png ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-fallback-title"
        >
          <Card className="w-full max-w-sm flex flex-col gap-4 p-5 relative">
            <button
              type="button"
              onClick={() => setShareFallbackOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1 hover:bg-[rgb(var(--sr-border))]/50"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div>
              <h3 id="share-fallback-title" className="font-semibold">
                Share visitor pass
              </h3>
              <p className="text-sm sr-muted mt-1">
                Access code copied. Download the QR or copy the code again to send to your guest.
              </p>
            </div>
            <div className="flex justify-center py-2">
              <Image
                src={qr.data.png}
                alt="Visitor QR pass"
                width={200}
                height={200}
                unoptimized
              />
            </div>
            <p className="font-mono text-center text-2xl font-bold tracking-[0.25em]">
              {visitor.accessCode}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={onCopyCode}>
                <Copy className="size-4" />
                Copy code
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadVisitorQrPng(qr.data!.png, visitor.accessCode!)}
              >
                <Download className="size-4" />
                Download QR
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
