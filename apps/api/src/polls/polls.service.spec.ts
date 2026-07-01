import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PollAudienceScope, PollStatus, RoleId } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollsService } from './polls.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const UNIT2 = 'unit-2';
const OWNER_ID = 'owner-1';
const TENANT_ID = 'tenant-1';
const POLL_ID = 'poll-1';
const OPTION_A = 'opt-a';
const OPTION_B = 'opt-b';
const OWNERSHIP_ID = 'own-1';

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

function tenant(): AuthenticatedUser {
  return {
    id: TENANT_ID,
    email: 't@b.c',
    name: 'Tenant',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.TENANT,
    roles: [{ roleId: RoleId.TENANT, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function openPoll(overrides: Record<string, unknown> = {}) {
  return {
    id: POLL_ID,
    condoId: CONDO,
    title: 'Rooftop awning',
    description: 'Should we add an awning?',
    status: PollStatus.OPEN,
    opensAt: new Date(Date.now() - 60_000),
    closesAt: new Date(Date.now() + 86_400_000),
    audienceScope: PollAudienceScope.ALL_OWNERS,
    blockIds: [],
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: 'mgr-1',
    options: [
      { id: OPTION_A, pollId: POLL_ID, label: 'Yes', position: 0 },
      { id: OPTION_B, pollId: POLL_ID, label: 'No', position: 1 },
    ],
    ...overrides,
  };
}

function buildPrisma() {
  const pollVoteCreate = vi.fn();
  const auditLogCreate = vi.fn();
  const pollVoteFindMany = vi.fn(async () => []);
  const ownershipFindFirst = vi.fn(async () => ({
    id: OWNERSHIP_ID,
    sharePercent: 100,
    unit: { id: UNIT, condoId: CONDO, blockId: 'block-1', identifier: 'A-01-01' },
  }));

  const prisma = {
    poll: {
      findUnique: vi.fn(async () => openPoll()),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...openPoll(),
        ...data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    pollOption: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    pollVote: {
      create: pollVoteCreate,
      findMany: pollVoteFindMany,
    },
    ownership: {
      findFirst: ownershipFindFirst,
    },
    auditLog: {
      create: auditLogCreate,
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)({
          pollVote: { create: pollVoteCreate },
          auditLog: { create: auditLogCreate },
          pollOption: prisma.pollOption,
          poll: prisma.poll,
        });
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    pollVoteCreate,
    ownershipFindFirst,
    auditLogCreate,
  };
}

describe('PollsService', () => {
  let service: PollsService;
  let prisma: ReturnType<typeof buildPrisma>['prisma'];
  let pollVoteCreate: ReturnType<typeof buildPrisma>['pollVoteCreate'];
  let ownershipFindFirst: ReturnType<typeof buildPrisma>['ownershipFindFirst'];
  let auditLogCreate: ReturnType<typeof buildPrisma>['auditLogCreate'];

  beforeEach(() => {
    const built = buildPrisma();
    prisma = built.prisma;
    pollVoteCreate = built.pollVoteCreate;
    ownershipFindFirst = built.ownershipFindFirst;
    auditLogCreate = built.auditLogCreate;
    service = new PollsService(prisma);
  });

  it('allows an owner with active ownership to cast a vote', async () => {
    pollVoteCreate.mockResolvedValue({ id: 'vote-1' });

    const result = await service.castVote(owner(), POLL_ID, {
      unitId: UNIT,
      optionId: OPTION_A,
    });

    expect(pollVoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: POLL_ID,
          optionId: OPTION_A,
          unitId: UNIT,
          userId: OWNER_ID,
          ownershipId: OWNERSHIP_ID,
        }),
      }),
    );
    expect(auditLogCreate).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('rejects tenants from voting', async () => {
    await expect(
      service.castVote(tenant(), POLL_ID, { unitId: UNIT, optionId: OPTION_A }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pollVoteCreate).not.toHaveBeenCalled();
  });

  it('rejects vote when user has no active ownership on unit', async () => {
    ownershipFindFirst.mockResolvedValue(null);

    await expect(
      service.castVote(owner(), POLL_ID, { unitId: UNIT, optionId: OPTION_A }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pollVoteCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate vote for the same unit', async () => {
    pollVoteCreate.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.castVote(owner(), POLL_ID, { unitId: UNIT, optionId: OPTION_A }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects vote when poll is not open', async () => {
    vi.mocked(prisma.poll.findUnique).mockResolvedValue(
      openPoll({ status: PollStatus.DRAFT }) as never,
    );

    await expect(
      service.castVote(owner(), POLL_ID, { unitId: UNIT, optionId: OPTION_A }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects vote when unit is outside poll audience blocks', async () => {
    vi.mocked(prisma.poll.findUnique).mockResolvedValue(
      openPoll({
        audienceScope: PollAudienceScope.BLOCK,
        blockIds: ['other-block'],
      }) as never,
    );
    ownershipFindFirst.mockResolvedValue({
      id: OWNERSHIP_ID,
      sharePercent: 50,
      unit: { id: UNIT, condoId: CONDO, blockId: 'block-1', identifier: 'A-01-01' },
    });

    await expect(
      service.castVote(owner(), POLL_ID, { unitId: UNIT, optionId: OPTION_A }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores sharePercent snapshot as vote weight', async () => {
    pollVoteCreate.mockResolvedValue({ id: 'vote-1' });
    ownershipFindFirst.mockResolvedValue({
      id: OWNERSHIP_ID,
      sharePercent: 33.333,
      unit: { id: UNIT2, condoId: CONDO, blockId: 'block-1', identifier: 'A-01-02' },
    });

    await service.castVote(owner(), POLL_ID, { unitId: UNIT2, optionId: OPTION_B });

    expect(pollVoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: UNIT2,
          weight: 33.333,
        }),
      }),
    );
  });
});
