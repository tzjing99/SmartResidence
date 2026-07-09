import type { LedgerService } from '@/billing/ledger.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PollsService } from '@/polls/polls.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { GeneralMeetingStatus, PollStatus, RoleId } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GovernanceService } from './governance.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const OWNER_ID = 'owner-1';
const PROXY_HOLDER_ID = 'proxy-holder-1';
const MGR_ID = 'mgr-1';
const MEETING_ID = 'meet-1';

function owner(): AuthenticatedUser {
  return {
    id: OWNER_ID,
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function proxyHolder(): AuthenticatedUser {
  return {
    id: PROXY_HOLDER_ID,
    email: 'proxy@b.c',
    name: 'Proxy Holder',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: 'unit-2', permissions: [] }],
  };
}

function manager(): AuthenticatedUser {
  return {
    id: MGR_ID,
    email: 'm@b.c',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, permissions: [] }],
  };
}

function draftMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: MEETING_ID,
    condoId: CONDO,
    kind: 'AGM',
    title: '2026 AGM',
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    noticeBody: 'Notice text here.',
    quorumPercent: 50,
    status: GeneralMeetingStatus.DRAFT,
    createdByUserId: MGR_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: MGR_ID, name: 'Manager' },
    resolutions: [],
    _count: { proxies: 0 },
    ...overrides,
  };
}

function buildService() {
  const events = { emit: vi.fn() };
  const polls = {
    castVote: vi.fn(async () => []),
    castVoteWithOwnership: vi.fn(async () => []),
    computeResultsSnapshot: vi.fn(async () => ({
      totalVotes: 1,
      totalWeight: 100,
      options: [{ id: 'opt-1', label: 'For', voteCount: 1, weightSum: 100, weightPercent: 100 }],
    })),
    getOne: vi.fn(async () => ({
      id: 'poll-1',
      status: 'CLOSED',
      results: { totalVotes: 1, totalWeight: 100, options: [] },
      options: [],
      myVotes: [],
    })),
  };

  const ledger = {
    fundBalances: vi.fn(async () => [
      { fund: 'MAINTENANCE', balance: 12_345.67 },
      { fund: 'SINKING_FUND', balance: 890.12 },
    ]),
  };

  const generalMeeting = {
    findUnique: vi.fn(async () => draftMeeting()),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    create: vi.fn(async () => draftMeeting()),
    update: vi.fn(async () => ({
      ...draftMeeting(),
      status: GeneralMeetingStatus.NOTICE_PUBLISHED,
    })),
  };

  const meetingProxy = {
    create: vi.fn(async () => ({
      id: 'proxy-1',
      meetingId: MEETING_ID,
      unitId: UNIT,
      ownerUserId: OWNER_ID,
      proxyHolderName: 'Jane Doe',
      proxyHolderContact: '',
      submittedAt: new Date(),
      unit: { id: UNIT, identifier: 'A-01-01' },
    })),
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
  };

  const meetingResolution = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };

  const ownership = {
    findFirst: vi.fn(async () => ({
      id: 'own-1',
      userId: OWNER_ID,
      sharePercent: 100,
      unit: { id: UNIT, condoId: CONDO, blockId: 'block-1', identifier: 'A-01-01' },
    })),
    findMany: vi.fn(async () => [
      {
        unitId: UNIT,
        sharePercent: 100,
        userId: OWNER_ID,
        unit: { id: UNIT, identifier: 'A-01-01' },
        user: { id: OWNER_ID, name: 'Owner' },
      },
    ]),
  };

  const pollVote = {
    findMany: vi.fn(async () => []),
  };

  const user = {
    findUnique: vi.fn(async () => ({
      id: PROXY_HOLDER_ID,
      roleAssignments: [{ condoId: CONDO }],
    })),
    findFirst: vi.fn(async () => null),
  };

  const poll = {
    create: vi.fn(async () => ({ id: 'poll-1' })),
    update: vi.fn(),
  };

  const auditLog = {
    create: vi.fn(),
  };

  const prisma = {
    generalMeeting,
    meetingProxy,
    meetingResolution,
    ownership,
    user,
    poll,
    pollVote,
    auditLog,
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const service = new GovernanceService(
    prisma,
    polls as unknown as PollsService,
    ledger as unknown as LedgerService,
    events as unknown as EventEmitter2,
  );

  return {
    service,
    prisma,
    polls,
    ledger,
    events,
    meetingProxy,
    generalMeeting,
    meetingResolution,
    auditLog,
  };
}

describe('GovernanceService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects proxy submission from non-owners', async () => {
    const { service } = buildService();
    const tenant = {
      ...owner(),
      id: 'tenant-1',
      roles: [{ roleId: RoleId.TENANT, condoId: CONDO, unitId: UNIT, permissions: [] }],
    };
    await expect(
      service.submitProxy(tenant, MEETING_ID, {
        unitId: UNIT,
        proxyHolderName: 'Jane',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publishes notice and emits event', async () => {
    const { service, events, generalMeeting } = buildService();
    const result = await service.publishNotice(manager(), MEETING_ID);
    expect(result.status).toBe(GeneralMeetingStatus.NOTICE_PUBLISHED);
    expect(generalMeeting.update).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('governance.notice.published', {
      meetingId: MEETING_ID,
      condoId: CONDO,
    });
  });

  it('rejects publishing notice without body', async () => {
    const { service, generalMeeting } = buildService();
    generalMeeting.findUnique.mockResolvedValueOnce(draftMeeting({ noticeBody: '  ' }));
    await expect(service.publishNotice(manager(), MEETING_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('submits proxy for owned unit and emits event', async () => {
    const { service, events, meetingProxy, generalMeeting } = buildService();
    generalMeeting.findUnique.mockResolvedValueOnce(
      draftMeeting({ status: GeneralMeetingStatus.NOTICE_PUBLISHED }),
    );
    const result = await service.submitProxy(owner(), MEETING_ID, {
      unitId: UNIT,
      proxyHolderName: 'Jane Doe',
    });
    expect(result.proxyHolderName).toBe('Jane Doe');
    expect(meetingProxy.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'governance.proxy.submitted',
      expect.objectContaining({ meetingId: MEETING_ID, ownerUserId: OWNER_ID }),
    );
  });

  it('casts owner ballot with immutable meeting audit metadata when no proxy', async () => {
    const { service, polls, meetingResolution, meetingProxy } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      meetingId: MEETING_ID,
      meeting: { condoId: CONDO, status: GeneralMeetingStatus.IN_PROGRESS },
      poll: { id: 'poll-1', status: PollStatus.OPEN },
    });
    meetingProxy.findUnique.mockResolvedValueOnce(null);
    await service.castResolutionVote(owner(), 'res-1', {
      unitId: UNIT,
      optionId: 'opt-1',
    });
    expect(polls.castVoteWithOwnership).toHaveBeenCalledWith(
      owner(),
      'poll-1',
      { unitId: UNIT, optionId: 'opt-1' },
      expect.objectContaining({ id: 'own-1' }),
      expect.objectContaining({
        viaProxy: false,
        meetingId: MEETING_ID,
        resolutionId: 'res-1',
        ownerUserId: OWNER_ID,
      }),
    );
  });

  it('blocks owner vote when proxy submitted and routes proxy holder vote', async () => {
    const { service, polls, meetingResolution, meetingProxy } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      meetingId: MEETING_ID,
      meeting: { condoId: CONDO, status: GeneralMeetingStatus.IN_PROGRESS },
      poll: { id: 'poll-1', status: PollStatus.OPEN },
    });
    meetingProxy.findUnique.mockResolvedValueOnce({
      id: 'proxy-1',
      meetingId: MEETING_ID,
      unitId: UNIT,
      ownerUserId: OWNER_ID,
      proxyHolderUserId: PROXY_HOLDER_ID,
      proxyHolderContact: '',
    });

    await expect(
      service.castResolutionVote(owner(), 'res-1', { unitId: UNIT, optionId: 'opt-1' }),
    ).rejects.toBeInstanceOf(ConflictException);

    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      meetingId: MEETING_ID,
      meeting: { condoId: CONDO, status: GeneralMeetingStatus.IN_PROGRESS },
      poll: { id: 'poll-1', status: PollStatus.OPEN },
    });
    meetingProxy.findUnique.mockResolvedValueOnce({
      id: 'proxy-1',
      meetingId: MEETING_ID,
      unitId: UNIT,
      ownerUserId: OWNER_ID,
      proxyHolderUserId: PROXY_HOLDER_ID,
      proxyHolderContact: '',
    });

    await service.castResolutionVote(proxyHolder(), 'res-1', {
      unitId: UNIT,
      optionId: 'opt-1',
    });

    expect(polls.castVoteWithOwnership).toHaveBeenCalledWith(
      proxyHolder(),
      'poll-1',
      { unitId: UNIT, optionId: 'opt-1' },
      expect.any(Object),
      expect.objectContaining({
        viaProxy: true,
        proxyId: 'proxy-1',
        meetingId: MEETING_ID,
      }),
    );
  });

  it('closes resolution voting with immutable snapshot, quorum, and audit log', async () => {
    const { service, polls, meetingResolution, auditLog, events, prisma } = buildService();
    meetingResolution.findUnique
      .mockResolvedValueOnce({
        id: 'res-1',
        meetingId: MEETING_ID,
        pollId: 'poll-1',
        votingClosesAt: null,
        meeting: { condoId: CONDO, quorumPercent: 50 },
        poll: { id: 'poll-1', status: PollStatus.OPEN, options: [] },
      })
      .mockResolvedValueOnce({
        id: 'res-1',
        meetingId: MEETING_ID,
        pollId: 'poll-1',
        votingClosesAt: new Date(),
        resultsSnapshot: {
          totalVotes: 1,
          totalWeight: 100,
          options: [],
          quorum: { met: true, quorumPercent: 50 },
        },
        poll: {
          id: 'poll-1',
          status: PollStatus.CLOSED,
          opensAt: new Date(),
          closesAt: new Date(),
        },
      });

    vi.mocked(prisma.pollVote.findMany).mockResolvedValueOnce([
      { unitId: UNIT, weight: 100 },
    ] as never);

    await service.closeResolutionVoting(manager(), 'res-1');

    expect(polls.computeResultsSnapshot).toHaveBeenCalledWith('poll-1', true);
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            event: 'governance.resolution.voting_closed',
            quorumMet: true,
          }),
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'governance.resolution.closed',
      expect.objectContaining({ resolutionId: 'res-1', quorumMet: true }),
    );
    expect(prisma.poll.update).toHaveBeenCalled();
  });

  it('returns voting eligibility with proxy-blocked owned units', async () => {
    const { service, meetingResolution, meetingProxy, prisma } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      meetingId: MEETING_ID,
      meeting: {
        condoId: CONDO,
        status: GeneralMeetingStatus.IN_PROGRESS,
        quorumPercent: 50,
      },
      poll: { id: 'poll-1', status: PollStatus.OPEN, opensAt: new Date(), closesAt: null },
    });
    meetingProxy.findMany.mockResolvedValueOnce([
      {
        id: 'proxy-1',
        unitId: UNIT,
        ownerUserId: OWNER_ID,
        proxyHolderUserId: PROXY_HOLDER_ID,
        proxyHolderContact: '',
        unit: { id: UNIT, identifier: 'A-01-01' },
        owner: { id: OWNER_ID, name: 'Owner' },
      },
    ]);
    vi.mocked(prisma.pollVote.findMany).mockResolvedValueOnce([]);

    const result = await service.getVotingEligibility(owner(), 'res-1');
    expect(result.votingOpen).toBe(true);
    expect(result.eligibleUnits[0]?.blockedReason).toMatch(/proxy/i);
    expect(result.castableUnitCount).toBe(0);
    expect(result.quorum.quorumPercent).toBe(50);
  });

  it('opens resolution voting by creating a poll, freezing eligibility, and emitting event', async () => {
    const { service, events, meetingResolution, prisma } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      title: 'Approve budget',
      description: 'FY2026 budget',
      pollId: null,
      meetingId: MEETING_ID,
      meeting: { id: MEETING_ID, condoId: CONDO, status: GeneralMeetingStatus.NOTICE_PUBLISHED },
    });
    vi.mocked(prisma.meetingResolution.update).mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      votingOpensAt: new Date(),
      votingClosesAt: null,
      eligibilitySnapshot: { unitCount: 1, totalShareWeight: 100, units: [] },
      poll: { id: 'poll-1', status: 'OPEN', opensAt: new Date(), closesAt: null },
    } as never);

    const result = await service.openResolutionVoting(manager(), 'res-1', {});
    expect(result.poll?.id).toBe('poll-1');
    expect(prisma.meetingResolution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eligibilitySnapshot: expect.objectContaining({ unitCount: expect.any(Number) }),
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'governance.resolution.opened',
      expect.objectContaining({ resolutionId: 'res-1', pollId: 'poll-1' }),
    );
  });

  it('rejects opening voting when a poll already exists', async () => {
    const { service, meetingResolution } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-existing',
      meeting: { condoId: CONDO, status: GeneralMeetingStatus.IN_PROGRESS },
    });
    await expect(service.openResolutionVoting(manager(), 'res-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('captures a financial snapshot when publishing notice', async () => {
    const { service, ledger, generalMeeting } = buildService();
    await service.publishNotice(manager(), MEETING_ID);
    expect(ledger.fundBalances).toHaveBeenCalledWith(CONDO);
    expect(generalMeeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          financialSnapshot: expect.objectContaining({
            fundBalances: expect.any(Array),
          }),
        }),
      }),
    );
  });

  it('publishes minutes when voting is closed and emits event', async () => {
    const { service, events, generalMeeting } = buildService();
    generalMeeting.findUnique.mockResolvedValueOnce({
      ...draftMeeting({ status: GeneralMeetingStatus.IN_PROGRESS, minutesBody: 'Draft minutes.' }),
      resolutions: [{ pollId: 'poll-1', poll: { id: 'poll-1', status: PollStatus.CLOSED } }],
    });
    generalMeeting.update.mockResolvedValueOnce({
      ...draftMeeting({
        status: GeneralMeetingStatus.IN_PROGRESS,
        minutesBody: 'Draft minutes.',
        minutesPublishedAt: new Date('2026-06-02T12:00:00Z'),
      }),
    });

    const result = await service.publishMinutes(manager(), MEETING_ID, {});
    expect(result.minutesPublishedAt).toBeTruthy();
    expect(events.emit).toHaveBeenCalledWith('governance.minutes.published', {
      meetingId: MEETING_ID,
      condoId: CONDO,
    });
  });

  it('rejects publishing minutes while a resolution poll is still open', async () => {
    const { service, generalMeeting } = buildService();
    generalMeeting.findUnique.mockResolvedValueOnce({
      ...draftMeeting({ status: GeneralMeetingStatus.IN_PROGRESS, minutesBody: 'Draft minutes.' }),
      resolutions: [{ pollId: 'poll-1', poll: { id: 'poll-1', status: PollStatus.OPEN } }],
    });
    await expect(service.publishMinutes(manager(), MEETING_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects publishing minutes without body', async () => {
    const { service, generalMeeting } = buildService();
    generalMeeting.findUnique.mockResolvedValueOnce({
      ...draftMeeting({ status: GeneralMeetingStatus.CLOSED, minutesBody: '  ' }),
      resolutions: [],
    });
    await expect(service.publishMinutes(manager(), MEETING_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
