'use client';

import { SlaChip } from '@/components/sla-chip';
import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { sortInboxThreads } from '@/lib/inbox-sort';
import {
  CATEGORIES,
  PRIORITY_TONE,
  STATUS_TONE,
  categoryLabel,
  priorityLabel,
  slaLabel,
  statusLabel,
} from '@/lib/thread-ui';
import { useThreads } from '@smartresidence/api-client';
import type { ThreadCategory, ThreadPriority, ThreadStatus } from '@smartresidence/api-client';
import {
  Badge,
  Card,
  EmptyState,
  Skeleton,
  cn,
  iosSpring,
  listStaggerDelay,
} from '@smartresidence/ui-web';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const selectCls = 'sr-select w-auto';

export default function HelpdeskPage() {
  const tr = useT();
  const reduceMotion = useReducedMotion();
  const STATUS_OPTIONS: Array<{ value: ThreadStatus | ''; label: string }> = [
    { value: '', label: tr('helpdesk.filters.allStatuses') },
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
    ).map((value) => ({ value, label: statusLabel(tr, value) })),
  ];
  const PRIORITY_OPTIONS: Array<{ value: ThreadPriority | ''; label: string }> = [
    { value: '', label: tr('helpdesk.filters.allPriorities') },
    ...(['URGENT', 'HIGH', 'NORMAL', 'LOW'] as ThreadPriority[]).map((value) => ({
      value,
      label: priorityLabel(tr, value),
    })),
  ];
  const SLA_OPTIONS = [
    { value: '', label: tr('helpdesk.filters.anySla') },
    { value: 'BREACHED', label: slaLabel(tr, 'BREACHED') },
    { value: 'AT_RISK', label: slaLabel(tr, 'AT_RISK') },
    { value: 'ON_TRACK', label: slaLabel(tr, 'ON_TRACK') },
  ] as const;
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
        <h2 className="sr-section-title">{tr('helpdesk.title')}</h2>
        <p className="sr-muted">{tr('helpdesk.subtitle')}</p>
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
          <option value="">{tr('helpdesk.filters.allCategories')}</option>
          {CATEGORIES.map((o) => (
            <option key={o.value} value={o.value}>
              {tr(o.labelKey)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by assignee"
          className={selectCls}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="">{tr('helpdesk.filters.allAssignees')}</option>
          <option value="__unassigned">{tr('helpdesk.filters.unassigned')}</option>
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
        <p className="ml-auto text-meta">{tr('helpdesk.detail.sortedHint')}</p>
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
          title={tr('helpdesk.empty')}
          description={tr('helpdesk.emptyHint')}
        />
      ) : (
        <>
          {/* Column header (desktop only) */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 text-[11px] font-medium uppercase tracking-wide sr-muted">
            <div className="col-span-5">{tr('helpdesk.columns.subject')}</div>
            <div className="col-span-2">{tr('helpdesk.columns.requester')}</div>
            <div className="col-span-1">{tr('helpdesk.columns.priority')}</div>
            <div className="col-span-2">{tr('helpdesk.columns.status')}</div>
            <div className="col-span-2">{tr('helpdesk.columns.sla')}</div>
          </div>

          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {visible.map((t, index) => {
                const needsAttention =
                  t.status === 'AWAITING_MANAGEMENT' || t.status === 'REOPENED';
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { ...iosSpring.default, delay: listStaggerDelay(index) }
                    }
                  >
                    <Link href={`/admin/helpdesk/${t.id}`}>
                      <Card
                        interactive
                        className={cn(
                          'transition-[box-shadow,border-color] duration-150 hover:shadow-md hover:border-[rgb(var(--sr-coral))]/25',
                          needsAttention &&
                            'border-l-[3px] border-l-coral-500/70 bg-coral-50/20 dark:bg-coral-950/10',
                        )}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-start">
                          <div className="lg:col-span-5 min-w-0">
                            <div
                              className={cn(
                                'truncate leading-tight',
                                needsAttention ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {t.subject}
                            </div>
                            <div className="text-meta-row mt-0.5">
                              <Badge tone="neutral">{categoryLabel(tr, t.category)}</Badge>
                              <span className="text-meta-sep">·</span>
                              <span>
                                {tr('helpdesk.detail.msgCount', { count: t._count?.messages ?? 0 })}
                              </span>
                              <span className="text-meta-sep">·</span>
                              <span>
                                {tr('helpdesk.detail.updated', {
                                  date: new Date(t.lastMessageAt).toLocaleDateString(),
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="lg:col-span-2 text-sm min-w-0">
                            <div className="truncate">
                              {t.createdBy?.name ?? tr('helpdesk.detail.residentFallback')}
                            </div>
                            {t.unit?.identifier ? (
                              <div className="text-meta">
                                {tr('admin.dashboard.unitPrefix', { unit: t.unit.identifier })}
                              </div>
                            ) : null}
                          </div>
                          <div className="lg:col-span-1 flex min-w-0 flex-col items-start">
                            <Badge tone={PRIORITY_TONE[t.priority]}>
                              {priorityLabel(tr, t.priority)}
                            </Badge>
                          </div>
                          <div className="lg:col-span-2 flex min-w-0 flex-col items-start gap-1">
                            <Badge tone={STATUS_TONE[t.status]}>{statusLabel(tr, t.status)}</Badge>
                            <span className="text-meta block min-w-0 max-w-full truncate leading-snug">
                              {t.assignedTo?.name ?? tr('helpdesk.noAssignee')}
                            </span>
                          </div>
                          <div className="lg:col-span-2 flex min-w-0 flex-col items-start">
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
                );
              })}
            </AnimatePresence>
          </ul>
        </>
      )}
    </div>
  );
}
