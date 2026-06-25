'use client';

import { DefectStatusBadge } from '@/components/defect-ui';
import { DefectBulkSignOffButton, DefectSignOffActions } from '@/components/defect-sign-off';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  queryKeys,
  useBulkUpdateReportItems,
  useDefectReport,
  useTransitionDefect,
} from '@smartresidence/api-client';
import { defectReference } from '@smartresidence/shared-types';
import { Badge, Card, Skeleton, cn } from '@smartresidence/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

export default function ResidentPackageDetailPage() {
  const params = useParams<{ id: string }>();
  const report = useDefectReport(api, params.id);
  const detail = report.data;
  const qc = useQueryClient();
  const transition = useTransitionDefect(api);
  const bulk = useBulkUpdateReportItems(api);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  async function signOff(itemId: string, status: 'CLOSED' | 'REOPENED') {
    setPendingIds((prev) => new Set(prev).add(itemId));
    try {
      await transition.mutateAsync({ id: itemId, status });
      qc.invalidateQueries({ queryKey: queryKeys.defectReport(params.id) });
      toast.success(status === 'CLOSED' ? 'Defect accepted and closed.' : 'Defect sent back for more work.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function acceptAll() {
    if (!detail) return;
    const ids = detail.items.filter((i) => i.status === 'RESOLVED').map((i) => i.id);
    if (ids.length === 0) return;
    try {
      const res = await bulk.mutateAsync({ id: params.id, data: { defectIds: ids, status: 'CLOSED' } });
      toast.success(`${res.updated} defect(s) accepted and closed.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (report.isLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-2xl flex flex-col gap-4">
        <Link
          href="/defects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
        >
          <ArrowLeft className="size-4" /> My defects
        </Link>
        <p className="sr-muted">This package could not be found.</p>
      </div>
    );
  }

  const resolvedCount = detail.statusCounts.RESOLVED ?? 0;
  const done = resolvedCount + (detail.statusCounts.CLOSED ?? 0);
  const pct = detail.itemCount > 0 ? Math.round((done / detail.itemCount) * 100) : 0;
  const grouped = detail.items.reduce<Record<string, typeof detail.items>>((acc, item) => {
    const key = item.spaceLabel ?? 'Other';
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/defects"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
      >
        <ArrowLeft className="size-4" /> My defects
      </Link>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <PackageOpen className="size-6 shrink-0 text-[rgb(var(--sr-coral))] mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Defect Report</h1>
            <div className="text-sm font-mono text-[rgb(var(--sr-coral))] mt-0.5">{defectReference(detail.id)}</div>
            <p className="text-sm sr-muted mt-1">
              {detail.itemCount} defect(s) · raised{' '}
              {new Date(detail.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-2.5 rounded-full bg-[rgb(var(--sr-border))] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct === 100 ? 'bg-emerald-500' : 'bg-[rgb(var(--sr-coral))]',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">
            {done}/{detail.itemCount} fixed
          </span>
          {pct === 100 ? (
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          ) : (
            <Clock className="size-5 sr-muted shrink-0" />
          )}
        </div>

        {resolvedCount > 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
            {resolvedCount} defect(s) fixed and waiting for your confirmation — check
            below and tell management if anything needs revisiting.
          </p>
        ) : null}
      </Card>

      {resolvedCount > 0 ? (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {resolvedCount} defect(s) are ready for sign-off
          </p>
          <DefectBulkSignOffButton
            count={resolvedCount}
            pending={bulk.isPending}
            onConfirm={acceptAll}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {Object.entries(grouped).map(([room, items]) => (
          <div key={room}>
            <div className="text-xs font-semibold uppercase tracking-wide sr-muted mb-2">
              {room} — {items.length} {items.length === 1 ? 'defect' : 'defects'}
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {item.elementName
                          ? `${item.elementName}${item.issueName ? `: ${item.issueName}` : ''}`
                          : item.title}
                      </div>
                      {item.description && item.description !== item.title ? (
                        <div className="text-xs sr-muted mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <DefectStatusBadge status={item.status} />
                  </div>
                  {item.status === 'RESOLVED' ? (
                    <div className="mt-3">
                      <DefectSignOffActions
                        pending={pendingIds.has(item.id) || bulk.isPending}
                        onSignOff={() => signOff(item.id, 'CLOSED')}
                        onReject={() => signOff(item.id, 'REOPENED')}
                      />
                    </div>
                  ) : null}
                  {item.attachments.length > 0 ? (
                    <div className="mt-2 text-xs sr-muted">
                      {item.attachments.length} photo(s) attached
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
