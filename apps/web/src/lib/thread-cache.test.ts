import type { ThreadDetail, ThreadSummary } from '@smartresidence/api-client/client';
import { patchThreadInListCaches } from '@smartresidence/api-client/realtime';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

function summary(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: 't1',
    subject: 'Leaky tap',
    category: 'MAINTENANCE',
    priority: 'NORMAL',
    status: 'OPEN',
    slaState: 'ON_TRACK',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    ...overrides,
  } as ThreadSummary;
}

describe('patchThreadInListCaches', () => {
  it('does not crash when the ["threads"] prefix also matches the detail cache', () => {
    const qc = new QueryClient();
    // Inbox list cache: shape { items, total }.
    qc.setQueryData(['threads', {}], { items: [summary()], total: 1 });
    // Thread detail cache: ThreadDetail has `messages`, NOT `items`.
    const detail: ThreadDetail = { ...summary(), messages: [] };
    qc.setQueryData(['threads', 't1'], detail);

    // Resolution flow patches list caches; the detail key must be skipped, not crash.
    expect(() => patchThreadInListCaches(qc, summary({ status: 'RESOLVED' }))).not.toThrow();

    const list = qc.getQueryData<{ items: ThreadSummary[]; total: number }>(['threads', {}]);
    expect(list?.items[0]?.status).toBe('RESOLVED');
    // Detail cache untouched by the list patcher.
    expect(qc.getQueryData<ThreadDetail>(['threads', 't1'])?.messages).toEqual([]);
  });

  it('inserts a new summary when not already present in the list', () => {
    const qc = new QueryClient();
    qc.setQueryData(['threads', {}], { items: [summary()], total: 1 });
    patchThreadInListCaches(qc, summary({ id: 't2' }));
    const list = qc.getQueryData<{ items: ThreadSummary[]; total: number }>(['threads', {}]);
    expect(list?.items).toHaveLength(2);
    expect(list?.total).toBe(2);
  });
});
