import { slaDueAt } from '@/lib/thread-ui';
import type { SlaState, ThreadPriority, ThreadSummary } from '@smartresidence/api-client';

const SLA_RANK: Record<SlaState, number> = { BREACHED: 3, AT_RISK: 2, ON_TRACK: 1, NONE: 0 };

const PRIORITY_RANK: Record<ThreadPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/** F3 default inbox sort: SLA breach → AT_RISK → priority → oldest (by SLA due, then created). */
export function sortInboxThreads<T extends ThreadSummary>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const slaRank = SLA_RANK[b.slaState] - SLA_RANK[a.slaState];
    if (slaRank !== 0) return slaRank;

    const priRank = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priRank !== 0) return priRank;

    const da = slaDueAt(a);
    const db = slaDueAt(b);
    if (da && db) return new Date(da).getTime() - new Date(db).getTime();
    if (da) return -1;
    if (db) return 1;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
