'use client';

import { api } from '@/lib/api';
import { PRIORITY_TONE, SLA_TONE, STATUS_TONE, prettyLabel } from '@/lib/thread-ui';
import { useThreads } from '@smartresidence/api-client';
import type { ThreadPriority, ThreadStatus } from '@smartresidence/api-client';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import Link from 'next/link';
import * as React from 'react';

const STATUS_OPTIONS: Array<{ value: ThreadStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'AWAITING_MANAGEMENT', label: 'Awaiting management' },
  { value: 'AWAITING_RESIDENT', label: 'Awaiting resident' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REOPENED', label: 'Reopened' },
];

const PRIORITY_OPTIONS: Array<{ value: ThreadPriority | ''; label: string }> = [
  { value: '', label: 'All priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const SLA_OPTIONS = [
  { value: '', label: 'Any SLA' },
  { value: 'BREACHED', label: 'Breached' },
  { value: 'AT_RISK', label: 'At risk' },
  { value: 'ON_TRACK', label: 'On track' },
] as const;

const selectCls =
  'h-10 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm';

export default function HelpdeskPage() {
  const [status, setStatus] = React.useState<ThreadStatus | ''>('');
  const [priority, setPriority] = React.useState<ThreadPriority | ''>('');
  const [slaState, setSlaState] = React.useState<'' | 'BREACHED' | 'AT_RISK' | 'ON_TRACK'>('');

  const threads = useThreads(api, {
    status: status || undefined,
    priority: priority || undefined,
    slaState: slaState || undefined,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Helpdesk</h2>
        <p className="sr-muted">Resident conversations, prioritised and tracked against SLA.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className={selectCls}
          value={status}
          onChange={(e) => setStatus(e.target.value as ThreadStatus | '')}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={priority}
          onChange={(e) => setPriority(e.target.value as ThreadPriority | '')}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={slaState}
          onChange={(e) => setSlaState(e.target.value as '' | 'BREACHED' | 'AT_RISK' | 'ON_TRACK')}
        >
          {SLA_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {threads.isLoading ? (
        <Skeleton className="h-64" />
      ) : (threads.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No threads" description="No conversations match these filters." />
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.data?.items.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/helpdesk/${t.id}`}>
                <Card className="transition-colors hover:border-[rgb(var(--sr-coral))]/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.subject}</div>
                      <div className="text-xs sr-muted mt-0.5">
                        {t.unit?.identifier ? `Unit ${t.unit.identifier} · ` : ''}
                        {t.createdBy?.name ?? 'Resident'} · {prettyLabel(t.category)} · updated{' '}
                        {new Date(t.lastMessageAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {t.slaState !== 'NONE' ? (
                        <Badge tone={SLA_TONE[t.slaState]}>{prettyLabel(t.slaState)}</Badge>
                      ) : null}
                      <Badge tone={PRIORITY_TONE[t.priority]}>{prettyLabel(t.priority)}</Badge>
                      <Badge tone={STATUS_TONE[t.status]}>{prettyLabel(t.status)}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
