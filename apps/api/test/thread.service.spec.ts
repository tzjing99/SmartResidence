import { describe, expect, it, vi } from 'vitest';
import { SlaService } from '../src/threads/sla/sla.service';
import { ThreadPriorityService } from '../src/threads/sla/thread-priority.service';

describe('ThreadPriorityService', () => {
  const svc = new ThreadPriorityService();

  it('flags life-safety keywords as URGENT', () => {
    expect(
      svc.suggest({ subject: 'Fire in stairwell', body: 'smoke everywhere', category: 'GENERAL' }),
    ).toBe('URGENT');
    expect(
      svc.suggest({ subject: 'No water since morning', body: 'taps dry', category: 'MAINTENANCE' }),
    ).toBe('URGENT');
  });

  it('treats SECURITY category as at least HIGH', () => {
    expect(svc.suggest({ subject: 'Question', body: 'about gate', category: 'SECURITY' })).toBe(
      'HIGH',
    );
  });

  it('maps pressing keywords to HIGH', () => {
    expect(
      svc.suggest({ subject: 'Aircon not working', body: 'broken since', category: 'MAINTENANCE' }),
    ).toBe('HIGH');
  });

  it('defaults suggestions to NORMAL and suggestions to LOW', () => {
    expect(svc.suggest({ subject: 'General query', body: 'hello', category: 'GENERAL' })).toBe(
      'NORMAL',
    );
    expect(
      svc.suggest({ subject: 'Idea for the garden', body: 'more plants', category: 'SUGGESTION' }),
    ).toBe('LOW');
  });
});

function slaService() {
  const prisma: any = { slaPolicy: { findUnique: vi.fn() } };
  const events: any = { emit: vi.fn() };
  const notifications: any = { dispatch: vi.fn() };
  return { svc: new SlaService(prisma, events, notifications), prisma };
}

describe('SlaService', () => {
  it('computes due dates from default policy when none configured', async () => {
    const { svc, prisma } = slaService();
    prisma.slaPolicy.findUnique.mockResolvedValueOnce(null);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const due = await svc.computeDueDates('condo1', 'URGENT', from);
    // URGENT defaults: 60m first response, 240m resolution.
    expect(due.firstResponseDueAt.toISOString()).toBe('2026-01-01T01:00:00.000Z');
    expect(due.resolutionDueAt.toISOString()).toBe('2026-01-01T04:00:00.000Z');
    expect(due.slaPolicyId).toBeNull();
  });

  it('uses a configured active policy over defaults', async () => {
    const { svc, prisma } = slaService();
    prisma.slaPolicy.findUnique.mockResolvedValueOnce({
      id: 'pol1',
      active: true,
      firstResponseMins: 30,
      resolutionMins: 120,
    });
    const from = new Date('2026-01-01T00:00:00.000Z');
    const due = await svc.computeDueDates('condo1', 'HIGH', from);
    expect(due.firstResponseDueAt.toISOString()).toBe('2026-01-01T00:30:00.000Z');
    expect(due.slaPolicyId).toBe('pol1');
  });

  it('returns NONE for resolved/closed threads', () => {
    const { svc } = slaService();
    expect(
      svc.computeSlaState({
        status: 'RESOLVED',
        createdAt: new Date(),
        firstResponseDueAt: new Date(0),
        firstRespondedAt: null,
        resolutionDueAt: new Date(0),
        resolvedAt: null,
      }),
    ).toBe('NONE');
  });

  it('flags a past-due unanswered thread as BREACHED', () => {
    const { svc } = slaService();
    const now = new Date('2026-01-02T00:00:00.000Z');
    expect(
      svc.computeSlaState(
        {
          status: 'OPEN',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          firstResponseDueAt: new Date('2026-01-01T01:00:00.000Z'),
          firstRespondedAt: null,
          resolutionDueAt: new Date('2026-01-03T00:00:00.000Z'),
          resolvedAt: null,
        },
        now,
      ),
    ).toBe('BREACHED');
  });

  it('flags a thread near its due date as AT_RISK', () => {
    const { svc } = slaService();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const resolutionDueAt = new Date('2026-01-01T10:00:00.000Z'); // 10h window
    const now = new Date('2026-01-01T09:30:00.000Z'); // 30m left < 20% of 10h
    expect(
      svc.computeSlaState(
        {
          status: 'AWAITING_MANAGEMENT',
          createdAt,
          firstResponseDueAt: null,
          firstRespondedAt: new Date('2026-01-01T00:30:00.000Z'),
          resolutionDueAt,
          resolvedAt: null,
        },
        now,
      ),
    ).toBe('AT_RISK');
  });
});
