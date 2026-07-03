'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAcknowledgeSos,
  useCancelSos,
  useCondoSosAlerts,
  useMyCondos,
  useResolveSos,
} from '@smartresidence/api-client';
import type { SosAlert, SosKind, SosStatus } from '@smartresidence/shared-types';
import { SOS_KIND_LABELS, SOS_STATUS_LABELS, isSosOpen } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { MapPin, ShieldCheck, Siren } from 'lucide-react';

const STATUS_TONE: Record<SosStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'danger',
  ACKNOWLEDGED: 'warning',
  RESOLVED: 'success',
  CANCELLED: 'neutral',
};

const KIND_TONE: Record<SosKind, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  MEDICAL: 'info',
  SECURITY: 'warning',
  FIRE: 'danger',
  GENERAL: 'neutral',
};

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeSince(t: ReturnType<typeof useT>, d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return t('admin.safety.justNow');
  if (mins < 60) return t('admin.safety.minutesAgo', { mins });
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    if (remMins) return t('admin.safety.hoursMinutesAgo', { hours, mins: remMins });
    return t('admin.safety.hoursAgo', { hours });
  }
  const days = Math.floor(hours / 24);
  return t('admin.safety.daysAgo', { days });
}

function OpenAlertCard({ alert }: { alert: SosAlert }) {
  const t = useT();
  const acknowledge = useAcknowledgeSos(api);
  const resolve = useResolveSos(api);
  const cancel = useCancelSos(api);
  const pending = acknowledge.isPending || resolve.isPending || cancel.isPending;

  const handleAcknowledge = async () => {
    try {
      await acknowledge.mutateAsync(alert.id);
      toast.success('Alert acknowledged — help is on the way');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleResolve = async () => {
    const note = window.prompt('Resolution note (optional) — e.g. false alarm, medics attended:');
    if (note === null) return;
    try {
      await resolve.mutateAsync({ id: alert.id, resolutionNote: note.trim() || undefined });
      toast.success('Alert resolved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this SOS alert? Only do this if it was raised in error.')) return;
    try {
      await cancel.mutateAsync(alert.id);
      toast.success('Alert cancelled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="p-5 border-red-300/70 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Siren className="size-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-lg font-semibold">{SOS_KIND_LABELS[alert.kind]}</span>
            <Badge tone={KIND_TONE[alert.kind]}>{SOS_KIND_LABELS[alert.kind]}</Badge>
            <Badge tone={STATUS_TONE[alert.status]}>{SOS_STATUS_LABELS[alert.status]}</Badge>
          </div>
          <p className="text-sm mt-1.5">
            <span className="font-medium">{alert.raisedBy?.name ?? 'Resident'}</span>
            {alert.unit?.identifier ? ` · Unit ${alert.unit.identifier}` : ''}
          </p>
          {alert.locationNote ? (
            <p className="text-sm sr-muted mt-1 flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {alert.locationNote}
            </p>
          ) : null}
          <p className="text-xs sr-muted mt-1">
            Raised {timeSince(t, alert.createdAt)} · {fmtDateTime(alert.createdAt)}
            {alert.acknowledgedBy?.name ? ` · Acknowledged by ${alert.acknowledgedBy.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {alert.status === 'ACTIVE' ? (
            <Button
              size="sm"
              onClick={handleAcknowledge}
              disabled={pending}
              loading={acknowledge.isPending}
            >
              Acknowledge
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResolve}
            disabled={pending}
            loading={resolve.isPending}
          >
            Resolve
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RecentAlertRow({ alert }: { alert: SosAlert }) {
  const closedAt = alert.resolvedAt ?? alert.cancelledAt ?? alert.createdAt;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgb(var(--sr-border))] p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{SOS_KIND_LABELS[alert.kind]}</span>
          <Badge tone={STATUS_TONE[alert.status]}>{SOS_STATUS_LABELS[alert.status]}</Badge>
        </div>
        <p className="text-sm sr-muted mt-0.5">
          {alert.raisedBy?.name ?? 'Resident'}
          {alert.unit?.identifier ? ` · Unit ${alert.unit.identifier}` : ''}
          {` · ${fmtDateTime(closedAt)}`}
          {alert.resolvedBy?.name ? ` · by ${alert.resolvedBy.name}` : ''}
        </p>
        {alert.resolutionNote ? (
          <p className="text-sm sr-muted mt-1 italic">&ldquo;{alert.resolutionNote}&rdquo;</p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminSafetyPage() {
  const t = useT();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const alerts = useCondoSosAlerts(api, condo?.id ?? null);

  const active = (alerts.data?.active ?? []).filter((a) => isSosOpen(a.status));
  const recent = alerts.data?.recent ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Siren className="size-6 text-red-600 dark:text-red-400" />
          Safety & SOS
        </h1>
        <p className="text-sm sr-muted mt-1">
          Monitor and respond to panic alerts raised by residents and guards across the building.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active alerts</h2>
        {alerts.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : alerts.isError ? (
          <Card className="p-5">
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load SOS alerts. Please retry.
            </p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => alerts.refetch()}>
              Retry
            </Button>
          </Card>
        ) : active.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-medium">No active alerts — all clear</p>
                <p className="text-sm sr-muted mt-0.5">
                  You will see panic alerts here the moment a resident or guard raises one.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((a) => (
              <OpenAlertCard key={a.id} alert={a} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent</h2>
        {alerts.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No recent alerts"
            description="Resolved and cancelled alerts from the past will appear here."
          />
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <RecentAlertRow key={a.id} alert={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
