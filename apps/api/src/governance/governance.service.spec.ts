import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PollsService } from '@/polls/polls.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { GeneralMeetingStatus, RoleId } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GovernanceService } from './governance.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const OWNER_ID = 'owner-1';
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
    getOne: vi.fn(async () => ({ id: 'poll-1', status: 'OPEN', results: null })),
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
  };

  const meetingResolution = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };

  const ownership = {
    findFirst: vi.fn(async () => ({
      id: 'own-1',
      sharePercent: 100,
      unit: { condoId: CONDO },
    })),
  };

  const poll = {
    create: vi.fn(async () => ({ id: 'poll-1' })),
    update: vi.fn(),
  };

  const prisma = {
    generalMeeting,
    meetingProxy,
    meetingResolution,
    ownership,
    poll,
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const service = new GovernanceService(
    prisma,
    polls as unknown as PollsService,
    events as unknown as EventEmitter2,
  );

  return { service, prisma, polls, events, meetingProxy, generalMeeting, meetingResolution };
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

  it('delegates resolution vote to PollsService', async () => {
    const { service, polls, meetingResolution } = buildService();
    meetingResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      pollId: 'poll-1',
      meeting: { condoId: CONDO },
    });
    await service.castResolutionVote(owner(), 'res-1', {
      unitId: UNIT,
      optionId: 'opt-1',
    });
    expect(polls.castVote).toHaveBeenCalledWith(owner(), 'poll-1', {
      unitId: UNIT,
      optionId: 'opt-1',
    });
  });
});
