'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  copyVisitorAccessCode,
  downloadVisitorQrPng,
  shareVisitorPass,
} from '@/lib/visitor-pass-share';
import { useMyUnits, useUnitVisitors, useVisitorQr } from '@smartresidence/api-client';
import type { Visitor } from '@smartresidence/shared-types';
import { Badge, Button, Card, Dialog, Skeleton } from '@smartresidence/ui-web';
import { AlertTriangle, ArrowLeft, Copy, Download, Share2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function VisitorPassPage() {
  const t = useT();
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
      toast.success(t('visitors.pass.sharedToast'));
      return;
    }
    try {
      await copyVisitorAccessCode(visitor.accessCode);
      toast.success(t('visitors.pass.copiedShareToast'));
    } catch {
      toast.message(t('visitors.pass.copyFallbackToast'));
    }
    setShareFallbackOpen(true);
  }

  async function onCopyCode() {
    if (!visitor?.accessCode) return;
    try {
      await copyVisitorAccessCode(visitor.accessCode);
      toast.success(t('visitors.pass.copiedToast'));
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
        {t('visitors.pass.back')}
      </Link>

      {!visitor ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <header>
            <h2 className="sr-section-title">{visitor.name}</h2>
            <p className="sr-muted text-sm mt-1">
              {t('visitors.expectedAt', { time: new Date(visitor.expectedAt).toLocaleString() })}
            </p>
            <Badge tone={visitor.status === 'APPROVED' ? 'primary' : 'neutral'} className="mt-2">
              {t(`visitors.statusLabel.${visitor.status}`)}
            </Badge>
          </header>

          {visitor.status === 'PENDING_MANAGEMENT_APPROVAL' ? (
            <Card className="flex gap-3 border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm">
                {visitor.urgentOvernight
                  ? t('visitors.pass.pendingMgmtUrgent')
                  : t('visitors.pass.pendingMgmt')}
              </p>
            </Card>
          ) : null}

          {visitor.pendingManagementReview && visitor.status === 'APPROVED' ? (
            <Card className="flex gap-3 border-[rgb(var(--sr-primary)/0.25)] bg-[rgb(var(--sr-primary)/0.05)] p-4">
              <AlertTriangle className="size-5 shrink-0 text-[rgb(var(--sr-primary))]" />
              <p className="text-sm">{t('visitors.pass.autoApproved')}</p>
            </Card>
          ) : null}

          {visitor.accessCode ? (
            <Card className="text-center py-8">
              <p className="text-xs uppercase tracking-widest sr-muted mb-2">
                {t('visitors.pass.accessCode')}
              </p>
              <p className="font-mono text-4xl font-bold tracking-[0.3em]">{visitor.accessCode}</p>
              <p className="text-xs sr-muted mt-3">
                {visitor.overnight
                  ? t('visitors.pass.codeHintOvernight')
                  : t('visitors.pass.codeHint')}
              </p>
            </Card>
          ) : null}

          {qr.isLoading ? (
            <Skeleton className="h-64" />
          ) : qr.data?.png ? (
            <Card className="flex flex-col items-center gap-3 py-6">
              <Image
                src={qr.data.png}
                alt={t('visitors.pass.qrAlt')}
                width={256}
                height={256}
                unoptimized
              />
              <p className="text-xs sr-muted">{t('visitors.pass.scanHint')}</p>
            </Card>
          ) : null}

          {canShare ? (
            <div className="flex flex-col gap-3 pt-2">
              <Button size="lg" className="w-full" onClick={onShare}>
                <Share2 className="size-4" />
                {t('visitors.pass.share')}
              </Button>
              <button
                type="button"
                onClick={onCopyCode}
                className="text-sm text-[rgb(var(--sr-coral))] hover:underline self-center inline-flex items-center gap-1.5"
              >
                <Copy className="size-3.5" />
                {t('visitors.pass.copyOnly')}
              </button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={Boolean(shareFallbackOpen && visitor?.accessCode && qr.data?.png)}
        onClose={() => setShareFallbackOpen(false)}
        labelledBy="share-fallback-title"
        closeLabel={t('visitors.pass.close')}
        className="max-w-sm"
      >
        {visitor?.accessCode && qr.data?.png ? (
          <Card className="w-full flex flex-col gap-4 p-5 relative">
            <button
              type="button"
              onClick={() => setShareFallbackOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1 hover:bg-[rgb(var(--sr-border))]/50"
              aria-label={t('visitors.pass.close')}
            >
              <X className="size-4" />
            </button>
            <div>
              <h3 id="share-fallback-title" className="font-semibold">
                {t('visitors.pass.shareDialogTitle')}
              </h3>
              <p className="text-sm sr-muted mt-1">{t('visitors.pass.shareDialogBody')}</p>
            </div>
            <div className="flex justify-center py-2">
              <Image
                src={qr.data.png}
                alt={t('visitors.pass.qrAlt')}
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
                {t('visitors.pass.copyCode')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const png = qr.data?.png;
                  const code = visitor.accessCode;
                  if (png && code) downloadVisitorQrPng(png, code);
                }}
              >
                <Download className="size-4" />
                {t('visitors.pass.downloadQr')}
              </Button>
            </div>
          </Card>
        ) : null}
      </Dialog>
    </div>
  );
}
