'use client';

import { SlaChip } from '@/components/sla-chip';
import { api } from '@/lib/api';
import { sortInboxThreads } from '@/lib/inbox-sort';
import {
  CATEGORIES,
  PRIORITY_TONE,
  SLA_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  categoryLabel,
  priorityLabel,
  statusLabel,
} from '@/lib/thread-ui';
import { useThreads } from '@smartresidence/api-client';
import type { ThreadCategory, ThreadPriority, ThreadStatus } from '@smartresidence/api-client';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const STATUS_OPTIONS: Array<{ value: ThreadStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  ...(
    [
      'OPEN',
      'AWAITING_MANAGEMENT',
      'AWAITING_RESIDENT',
      'PENDING_RESIDENT_CONFIRMATION',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
    ] as ThreadStatus[]
  ).map((value) => ({ value, label: STATUS_LABEL[value] })),
];

const PRIORITY_OPTIONS: Array<{ value: ThreadPriority | ''; label: string }> = [
  { value: '', label: 'All priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const SLA_OPTIONS = [
  { value: '', label: 'Any deadline' },
  { value: 'BREACHED', label: SLA_LABEL.BREACHED },
  { value: 'AT_RISK', label: SLA_LABEL.AT_RISK },
  { value: 'ON_TRACK', label: SLA_LABEL.ON_TRACK },
] as const;

const selectCls =
  'h-10 rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--sr-coral))]';

export default function HelpdeskPage() {
  const [status, setStatus] = React.useState<ThreadStatus | ''>('');
  const [priority, setPriority] = React.useState<ThreadPriority | ''>('');
  const [category, setCategory] = React.useState('');
  const [assignee, setAssignee] = React.useState('');
  const [slaState, setSlaState] = React.useState<'' | 'BREACHED' | 'AT_RISK' | 'ON_TRACK'>('');

  const threads = useThreads(api, {
    status: status || undefined,
    priority: priority || undefined,
    category: (category as ThreadCategory) || undefined,
    limit: 100,
  });

  const items = threads.data?.items ?? [];

  // Assignee options derived from the loaded set so the filter always reflects
  // who actually has threads in view.
  const assigneeOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of items) {
      if (t.assignedTo?.id) map.set(t.assignedTo.id, t.assignedTo.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [items]);

  const visible = React.useMemo(() => {
    let list = items;
    if (slaState) list = list.filter((t) => t.slaState === slaState);
    if (assignee === '__unassigned') list = list.filter((t) => !t.assignedTo);
    else if (assignee) list = list.filter((t) => t.assignedTo?.id === assignee);
    return sortInboxThreads(list);
  }, [items, slaState, assignee]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="sr-section-title">Helpdesk</h2>
        <p className="sr-muted">Resident conversations, prioritised and tracked against SLA.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by status"
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
          aria-label="Filter by priority"
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
          aria-label="Filter by category"
          className={selectCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by assignee"
          className={selectCls}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="">All assignees</option>
          <option value="__unassigned">Not assigned yet</option>
          {assigneeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by SLA state"
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
        <p className="ml-auto text-xs sr-muted">Sorted: breach → at risk → priority → oldest</p>
      </div>

      {threads.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="No threads"
          description="No conversations match these filters."
        />
      ) : (
        <>
          {/* Column header (desktop only) */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 text-[11px] font-medium uppercase tracking-wide sr-muted">
            <div className="col-span-5">Subject</div>
            <div className="col-span-2">Requester</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">SLA</div>
          </div>

          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {visible.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link href={`/admin/helpdesk/${t.id}`}>
                    <Card className="transition-colors hover:border-[rgb(var(--sr-coral))]/40">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-center">
                        <div className="lg:col-span-5 min-w-0">
                          <div className="font-medium truncate">{t.subject}</div>
                          <div className="text-xs sr-muted mt-0.5 flex items-center gap-1.5">
                            <Badge tone="neutral">{categoryLabel(t.category)}</Badge>
                            <span>
                              {t._count?.messages ?? 0} msg · updated{' '}
                              {new Date(t.lastMessageAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="lg:col-span-2 text-sm min-w-0">
                          <div className="truncate">{t.createdBy?.name ?? 'Resident'}</div>
                          {t.unit?.identifier ? (
                            <div className="text-xs sr-muted">Unit {t.unit.identifier}</div>
                          ) : null}
                        </div>
                        <div className="lg:col-span-1">
                          <Badge tone={PRIORITY_TONE[t.priority]}>
                            {priorityLabel(t.priority)}
                          </Badge>
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-1 items-start">
                          <Badge tone={STATUS_TONE[t.status]}>{statusLabel(t.status)}</Badge>
                          <span className="text-xs sr-muted truncate">
                            {t.assignedTo?.name ?? 'No one assigned yet'}
                          </span>
                        </div>
                        <div className="lg:col-span-2">
                          <SlaChip
                            slaState={t.slaState}
                            firstResponseDueAt={t.firstResponseDueAt}
                            resolutionDueAt={t.resolutionDueAt}
                          />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </div>
  );
}
