import { LedgerService } from '@/billing/ledger.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PollsService } from '@/polls/polls.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  GeneralMeetingStatus,
  PollAudienceScope,
  PollStatus,
  type Prisma,
  RoleId,
} from '@prisma/client';
import type { MeetingFinancialSnapshot } from '@smartresidence/shared-types';
import type {
  CastResolutionVoteDto,
  CreateGeneralMeetingDto,
  CreateMeetingResolutionDto,
  OpenResolutionVotingDto,
  PublishMeetingMinutesDto,
  SubmitMeetingProxyDto,
  UpdateGeneralMeetingDto,
  UpdateMeetingResolutionDto,
} from './dto/governance.dto';

const DEFAULT_RESOLUTION_OPTIONS = [
  { label: 'For', position: 0 },
  { label: 'Against', position: 1 },
  { label: 'Abstain', position: 2 },
];

const meetingInclude = {
  createdBy: { select: { id: true, name: true } },
  resolutions: {
    orderBy: { position: 'asc' as const },
    include: {
      poll: {
        select: {
          id: true,
          status: true,
          opensAt: true,
          closesAt: true,
        },
      },
    },
  },
  _count: { select: { proxies: true } },
} satisfies Prisma.GeneralMeetingInclude;

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly polls: PollsService,
    private readonly ledger: LedgerService,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    user: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number; manage?: boolean },
  ) {
    this.assertCondoAccess(user, condoId);
    const manage = opts.manage === true && this.isManagementForCondo(user, condoId);

    const where: Prisma.GeneralMeetingWhereInput = { condoId };
    if (!manage) {
      where.status = { not: GeneralMeetingStatus.DRAFT };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.generalMeeting.findMany({
        where,
        include: meetingInclude,
        orderBy: [{ scheduledAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.generalMeeting.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.serializeMeeting(row, user, { manage })),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async getOne(user: AuthenticatedUser, id: string, opts?: { manage?: boolean }) {
    const row = await this.prisma.generalMeeting.findUnique({
      where: { id },
      include: meetingInclude,
    });
    if (!row) throw new NotFoundException();

    this.assertCondoAccess(user, row.condoId);
    const manage = opts?.manage ?? this.isManagementForCondo(user, row.condoId);

    if (!manage && row.status === GeneralMeetingStatus.DRAFT) {
      throw new NotFoundException();
    }

    const myProxies = this.canSubmitProxy(user)
      ? await this.fetchMyProxies(user.id, id)
      : undefined;
    const myProxyAssignments = await this.fetchMyProxyAssignments(user, id);

    const resolutions = await Promise.all(
      row.resolutions.map((res) => this.serializeResolution(res, user, { manage })),
    );

    return {
      ...this.serializeMeeting(row, user, { manage }),
      resolutions,
      myProxies,
      myProxyAssignments,
    };
  }

  async create(user: AuthenticatedUser, dto: CreateGeneralMeetingDto) {
    this.assertManagement(user, dto.condoId);

    const row = await this.prisma.generalMeeting.create({
      data: {
        condoId: dto.condoId,
        kind: dto.kind,
        title: dto.title.trim(),
        scheduledAt: dto.scheduledAt,
        noticeBody: dto.noticeBody?.trim() ?? '',
        quorumPercent: dto.quorumPercent ?? 50,
        createdByUserId: user.id,
      },
      include: meetingInclude,
    });

    return this.serializeMeeting(row, user, { manage: true });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateGeneralMeetingDto) {
    const existing = await this.prisma.generalMeeting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    this.assertManagement(user, existing.condoId);

    if (
      existing.status === GeneralMeetingStatus.CLOSED &&
      dto.status !== GeneralMeetingStatus.CLOSED
    ) {
      throw new BadRequestException('Closed meetings cannot be reopened');
    }
    if (existing.status !== GeneralMeetingStatus.DRAFT && dto.noticeBody !== undefined) {
      throw new BadRequestException('Notice body can only be edited while the meeting is a draft');
    }
    if (existing.minutesPublishedAt && dto.minutesBody !== undefined) {
      throw new BadRequestException('Minutes cannot be edited after they are published');
    }
    if (dto.minutesBody !== undefined && existing.status === GeneralMeetingStatus.DRAFT) {
      throw new BadRequestException('Minutes can only be edited after the notice is published');
    }
    if (
      dto.quorumPercent !== undefined &&
      existing.status !== GeneralMeetingStatus.DRAFT &&
      existing.status !== GeneralMeetingStatus.NOTICE_PUBLISHED
    ) {
      throw new BadRequestException(
        'Quorum can only be changed before voting is in progress or the meeting is closed',
      );
    }

    const row = await this.prisma.generalMeeting.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title?.trim(),
        scheduledAt: dto.scheduledAt,
        noticeBody: dto.noticeBody?.trim(),
        minutesBody: dto.minutesBody?.trim(),
        status: dto.status,
        quorumPercent: dto.quorumPercent,
      },
      include: meetingInclude,
    });

    return this.serializeMeeting(row, user, { manage: true });
  }

  async publishNotice(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.generalMeeting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    this.assertManagement(user, existing.condoId);

    if (existing.status !== GeneralMeetingStatus.DRAFT) {
      throw new BadRequestException('Only draft meetings can have their notice published');
    }
    if (!existing.noticeBody.trim()) {
      throw new BadRequestException('Notice body is required before publishing');
    }

    const financialSnapshot = await this.buildFinancialSnapshot(existing.condoId);

    const row = await this.prisma.generalMeeting.update({
      where: { id },
      data: {
        status: GeneralMeetingStatus.NOTICE_PUBLISHED,
        financialSnapshot: financialSnapshot as unknown as Prisma.InputJsonValue,
      },
      include: meetingInclude,
    });

    this.events.emit('governance.notice.published', {
      meetingId: id,
      condoId: row.condoId,
    });

    return this.serializeMeeting(row, user, { manage: true });
  }

  async publishMinutes(user: AuthenticatedUser, id: string, dto: PublishMeetingMinutesDto = {}) {
    const existing = await this.prisma.generalMeeting.findUnique({
      where: { id },
      include: {
        ...meetingInclude,
        resolutions: {
          orderBy: { position: 'asc' },
          include: {
            poll: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException();
    this.assertManagement(user, existing.condoId);

    if (
      existing.status !== GeneralMeetingStatus.IN_PROGRESS &&
      existing.status !== GeneralMeetingStatus.CLOSED
    ) {
      throw new BadRequestException(
        'Minutes can only be published when the meeting is in progress or closed',
      );
    }

    const openPoll = existing.resolutions.some(
      (r) => r.pollId && r.poll?.status === PollStatus.OPEN,
    );
    if (openPoll) {
      throw new BadRequestException(
        'All resolution polls must be closed before publishing minutes',
      );
    }

    const minutesBody = dto.minutesBody?.trim() ?? existing.minutesBody;
    if (!minutesBody.trim()) {
      throw new BadRequestException('Minutes body is required before publishing');
    }

    const row = await this.prisma.generalMeeting.update({
      where: { id },
      data: {
        minutesBody,
        minutesPublishedAt: new Date(),
      },
      include: meetingInclude,
    });

    this.events.emit('governance.minutes.published', {
      meetingId: id,
      condoId: row.condoId,
    });

    return this.serializeMeeting(row, user, { manage: true });
  }

  private async buildFinancialSnapshot(condoId: string): Promise<MeetingFinancialSnapshot> {
    const fundBalances = await this.ledger.fundBalances(condoId);
    return {
      capturedAt: new Date(),
      fundBalances,
    };
  }

  async addResolution(user: AuthenticatedUser, meetingId: string, dto: CreateMeetingResolutionDto) {
    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException();
    this.assertManagement(user, meeting.condoId);

    if (meeting.status === GeneralMeetingStatus.CLOSED) {
      throw new BadRequestException('Cannot add resolutions to a closed meeting');
    }

    const resolution = await this.prisma.meetingResolution.create({
      data: {
        meetingId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        position: dto.position ?? 0,
      },
      include: {
        poll: {
          select: { id: true, status: true, opensAt: true, closesAt: true },
        },
      },
    });

    return this.serializeResolution(resolution, user, { manage: true });
  }

  async updateResolution(
    user: AuthenticatedUser,
    resolutionId: string,
    dto: UpdateMeetingResolutionDto,
  ) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true, poll: true },
    });
    if (!resolution) throw new NotFoundException();
    this.assertManagement(user, resolution.meeting.condoId);

    if (resolution.pollId && resolution.poll?.status !== PollStatus.DRAFT) {
      throw new BadRequestException('Resolution cannot be edited after voting has opened');
    }

    const updated = await this.prisma.meetingResolution.update({
      where: { id: resolutionId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        position: dto.position,
      },
      include: {
        poll: {
          select: { id: true, status: true, opensAt: true, closesAt: true },
        },
      },
    });

    return this.serializeResolution(updated, user, { manage: true });
  }

  async openResolutionVoting(
    user: AuthenticatedUser,
    resolutionId: string,
    dto: OpenResolutionVotingDto,
  ) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true },
    });
    if (!resolution) throw new NotFoundException();
    this.assertManagement(user, resolution.meeting.condoId);

    if (resolution.pollId) {
      throw new BadRequestException('Voting is already open for this resolution');
    }
    if (
      resolution.meeting.status !== GeneralMeetingStatus.NOTICE_PUBLISHED &&
      resolution.meeting.status !== GeneralMeetingStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('Meeting notice must be published before opening voting');
    }

    const opensAt = dto.votingOpensAt ?? new Date();
    const closesAt = dto.votingClosesAt ?? null;
    if (closesAt && closesAt.getTime() <= opensAt.getTime()) {
      throw new BadRequestException('votingClosesAt must be after votingOpensAt');
    }

    const eligibilitySnapshot = await this.buildEligibilitySnapshot(resolution.meeting.condoId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const poll = await tx.poll.create({
        data: {
          condoId: resolution.meeting.condoId,
          title: resolution.title,
          description: resolution.description,
          status: PollStatus.OPEN,
          opensAt,
          closesAt,
          createdByUserId: user.id,
          audienceScope: PollAudienceScope.ALL_OWNERS,
          options: {
            create: DEFAULT_RESOLUTION_OPTIONS,
          },
        },
      });

      const res = await tx.meetingResolution.update({
        where: { id: resolutionId },
        data: {
          pollId: poll.id,
          votingOpensAt: opensAt,
          votingClosesAt: closesAt,
          eligibilitySnapshot: eligibilitySnapshot as Prisma.InputJsonValue,
        },
        include: {
          poll: {
            select: { id: true, status: true, opensAt: true, closesAt: true },
          },
        },
      });

      if (resolution.meeting.status === GeneralMeetingStatus.NOTICE_PUBLISHED) {
        await tx.generalMeeting.update({
          where: { id: resolution.meetingId },
          data: { status: GeneralMeetingStatus.IN_PROGRESS },
        });
      }

      return res;
    });

    this.events.emit('governance.resolution.opened', {
      resolutionId,
      meetingId: resolution.meetingId,
      condoId: resolution.meeting.condoId,
      pollId: updated.pollId,
    });

    return this.serializeResolution(updated, user, { manage: true, includePollDetail: true });
  }

  async closeResolutionVoting(user: AuthenticatedUser, resolutionId: string) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true, poll: { include: { options: { orderBy: { position: 'asc' } } } } },
    });
    if (!resolution) throw new NotFoundException();
    this.assertManagement(user, resolution.meeting.condoId);

    if (!resolution.pollId || !resolution.poll) {
      throw new BadRequestException('Voting is not open for this resolution');
    }
    if (resolution.poll.status === PollStatus.CLOSED) {
      throw new BadRequestException('Voting is already closed');
    }

    const resultsSnapshot = await this.polls.computeResultsSnapshot(resolution.pollId, true);
    const quorum = await this.computeQuorumForPoll(
      resolution.meeting.condoId,
      resolution.pollId,
      Number(resolution.meeting.quorumPercent),
    );
    const closedAt = new Date();
    const pollId = resolution.pollId;
    const snapshotWithQuorum = {
      ...resultsSnapshot,
      quorum,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.poll.update({
        where: { id: pollId },
        data: { status: PollStatus.CLOSED },
      });

      await tx.meetingResolution.update({
        where: { id: resolutionId },
        data: {
          resultsSnapshot: snapshotWithQuorum as Prisma.InputJsonValue,
          votingClosesAt: resolution.votingClosesAt ?? closedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          condoId: resolution.meeting.condoId,
          actorUserId: user.id,
          actorRole: user.activeRole ?? undefined,
          action: AuditAction.UPDATE,
          resourceType: 'MeetingResolution',
          resourceId: resolutionId,
          metadata: {
            event: 'governance.resolution.voting_closed',
            meetingId: resolution.meetingId,
            pollId: resolution.pollId,
            closedAt: closedAt.toISOString(),
            resultsSnapshot: snapshotWithQuorum,
            quorumMet: quorum.met,
          },
        },
      });
    });

    const updated = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: {
        poll: {
          select: { id: true, status: true, opensAt: true, closesAt: true },
        },
      },
    });

    if (!updated) throw new NotFoundException();

    this.events.emit('governance.resolution.closed', {
      resolutionId,
      meetingId: resolution.meetingId,
      condoId: resolution.meeting.condoId,
      pollId: resolution.pollId,
      quorumMet: quorum.met,
    });

    return this.serializeResolution(updated, user, {
      manage: true,
      includePollDetail: true,
      includeBreakdown: true,
    });
  }

  async getResolutionResults(user: AuthenticatedUser, resolutionId: string) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true },
    });
    if (!resolution) throw new NotFoundException();
    this.assertCondoAccess(user, resolution.meeting.condoId);

    const manage = this.isManagementForCondo(user, resolution.meeting.condoId);
    if (!manage && resolution.meeting.status === GeneralMeetingStatus.DRAFT) {
      throw new NotFoundException();
    }
    if (!resolution.pollId) {
      throw new BadRequestException('Voting has not opened for this resolution');
    }

    const poll = await this.polls.getOne(user, resolution.pollId, { manage });
    const snapshot = resolution.resultsSnapshot as Record<string, unknown> | null;
    return {
      resolutionId: resolution.id,
      title: resolution.title,
      pollId: resolution.pollId,
      votingOpensAt: resolution.votingOpensAt,
      votingClosesAt: resolution.votingClosesAt,
      poll: {
        ...poll,
        results: snapshot ?? poll.results,
      },
      resultsSnapshot: snapshot ?? undefined,
    };
  }

  async castResolutionVote(
    user: AuthenticatedUser,
    resolutionId: string,
    dto: CastResolutionVoteDto,
  ) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true, poll: { select: { id: true, status: true } } },
    });
    if (!resolution) throw new NotFoundException();
    if (!resolution.pollId || !resolution.poll) {
      throw new BadRequestException('Voting is not open for this resolution');
    }
    if (resolution.poll.status !== PollStatus.OPEN) {
      throw new BadRequestException('Voting is not open for this resolution');
    }
    if (
      resolution.meeting.status !== GeneralMeetingStatus.IN_PROGRESS &&
      resolution.meeting.status !== GeneralMeetingStatus.NOTICE_PUBLISHED
    ) {
      throw new BadRequestException('Meeting is not open for e-voting');
    }

    const ballotMeta = {
      meetingId: resolution.meetingId,
      resolutionId: resolution.id,
    };

    const proxy = await this.prisma.meetingProxy.findUnique({
      where: {
        meetingId_unitId: {
          meetingId: resolution.meetingId,
          unitId: dto.unitId,
        },
      },
    });

    if (proxy) {
      if (proxy.ownerUserId === user.id) {
        throw new ConflictException(
          'You submitted a proxy for this unit — only your proxy holder may vote',
        );
      }
      if (!this.isProxyHolder(user, proxy)) {
        throw new ForbiddenException('You are not the designated proxy holder for this unit');
      }

      const now = new Date();
      const ownership = await this.prisma.ownership.findFirst({
        where: {
          userId: proxy.ownerUserId,
          unitId: dto.unitId,
          status: 'ACTIVE',
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
        include: {
          unit: { select: { id: true, condoId: true, blockId: true, identifier: true } },
        },
      });
      if (!ownership) {
        throw new BadRequestException('Proxied unit has no active ownership record');
      }

      return this.polls.castVoteWithOwnership(user, resolution.pollId, dto, ownership, {
        viaProxy: true,
        proxyId: proxy.id,
        ownerUserId: proxy.ownerUserId,
        ...ballotMeta,
      });
    }

    // Direct owner vote — stamp meetingId on the immutable ballot via ownership path
    const now = new Date();
    const ownership = await this.prisma.ownership.findFirst({
      where: {
        userId: user.id,
        unitId: dto.unitId,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: {
        unit: { select: { id: true, condoId: true, blockId: true, identifier: true } },
      },
    });
    if (!ownership) {
      throw new ForbiddenException('You do not have active ownership on the selected unit');
    }
    if (ownership.unit.condoId !== resolution.meeting.condoId) {
      throw new BadRequestException('Unit does not belong to this meeting');
    }

    return this.polls.castVoteWithOwnership(user, resolution.pollId, dto, ownership, {
      viaProxy: false,
      ownerUserId: user.id,
      ...ballotMeta,
    });
  }

  /**
   * Units the caller may cast a ballot for on an open resolution
   * (owned units without proxy, or units where they are the proxy holder).
   */
  async getVotingEligibility(user: AuthenticatedUser, resolutionId: string) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: {
        meeting: true,
        poll: { select: { id: true, status: true, opensAt: true, closesAt: true } },
      },
    });
    if (!resolution) throw new NotFoundException();
    this.assertCondoAccess(user, resolution.meeting.condoId);

    const manage = this.isManagementForCondo(user, resolution.meeting.condoId);
    if (!manage && resolution.meeting.status === GeneralMeetingStatus.DRAFT) {
      throw new NotFoundException();
    }

    const pollOpen = resolution.poll?.status === PollStatus.OPEN;
    const meetingOpen =
      resolution.meeting.status === GeneralMeetingStatus.IN_PROGRESS ||
      resolution.meeting.status === GeneralMeetingStatus.NOTICE_PUBLISHED;

    const now = new Date();
    const ownerships = await this.prisma.ownership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        unit: { condoId: resolution.meeting.condoId },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { unit: { select: { id: true, identifier: true } } },
    });

    const proxies = await this.prisma.meetingProxy.findMany({
      where: { meetingId: resolution.meetingId },
      include: {
        unit: { select: { id: true, identifier: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    const proxyByUnit = new Map(proxies.map((p) => [p.unitId, p]));
    const heldProxies = proxies.filter((p) => this.isProxyHolder(user, p));

    const votedUnitIds = new Set<string>();
    if (resolution.pollId) {
      const votes = await this.prisma.pollVote.findMany({
        where: { pollId: resolution.pollId },
        select: { unitId: true },
      });
      for (const v of votes) votedUnitIds.add(v.unitId);
    }

    const eligibleUnits: Array<{
      unitId: string;
      unitIdentifier: string;
      sharePercent: number;
      viaProxy: boolean;
      ownerName?: string;
      alreadyVoted: boolean;
      blockedReason?: string;
    }> = [];

    for (const own of ownerships) {
      const proxy = proxyByUnit.get(own.unitId);
      if (proxy) {
        eligibleUnits.push({
          unitId: own.unitId,
          unitIdentifier: own.unit.identifier,
          sharePercent: Number(own.sharePercent),
          viaProxy: false,
          alreadyVoted: votedUnitIds.has(own.unitId),
          blockedReason: 'Proxy submitted — only the proxy holder may vote for this unit',
        });
        continue;
      }
      eligibleUnits.push({
        unitId: own.unitId,
        unitIdentifier: own.unit.identifier,
        sharePercent: Number(own.sharePercent),
        viaProxy: false,
        alreadyVoted: votedUnitIds.has(own.unitId),
      });
    }

    for (const proxy of heldProxies) {
      if (eligibleUnits.some((u) => u.unitId === proxy.unitId && !u.blockedReason)) continue;
      const ownerOwn = await this.prisma.ownership.findFirst({
        where: {
          userId: proxy.ownerUserId,
          unitId: proxy.unitId,
          status: 'ACTIVE',
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      });
      eligibleUnits.push({
        unitId: proxy.unitId,
        unitIdentifier: proxy.unit.identifier,
        sharePercent: ownerOwn ? Number(ownerOwn.sharePercent) : 0,
        viaProxy: true,
        ownerName: proxy.owner.name,
        alreadyVoted: votedUnitIds.has(proxy.unitId),
      });
    }

    const castable = eligibleUnits.filter((u) => !u.blockedReason && !u.alreadyVoted);
    const quorum = resolution.pollId
      ? await this.computeQuorumForPoll(
          resolution.meeting.condoId,
          resolution.pollId,
          Number(resolution.meeting.quorumPercent),
        )
      : await this.computeQuorumBaseline(
          resolution.meeting.condoId,
          Number(resolution.meeting.quorumPercent),
        );

    return {
      resolutionId: resolution.id,
      meetingId: resolution.meetingId,
      pollId: resolution.pollId,
      pollStatus: resolution.poll?.status ?? null,
      votingOpen: Boolean(pollOpen && meetingOpen),
      quorum,
      eligibleUnits,
      castableUnitCount: castable.length,
    };
  }

  /** Management-only immutable ballot ledger for a resolution. */
  async listResolutionBallots(user: AuthenticatedUser, resolutionId: string) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true },
    });
    if (!resolution) throw new NotFoundException();
    this.assertManagement(user, resolution.meeting.condoId);
    if (!resolution.pollId) {
      throw new BadRequestException('Voting has not opened for this resolution');
    }

    const ballots = await this.prisma.pollVote.findMany({
      where: { pollId: resolution.pollId },
      include: {
        option: { select: { id: true, label: true } },
        unit: { select: { id: true, identifier: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const quorum = await this.computeQuorumForPoll(
      resolution.meeting.condoId,
      resolution.pollId,
      Number(resolution.meeting.quorumPercent),
    );

    return {
      resolutionId: resolution.id,
      meetingId: resolution.meetingId,
      pollId: resolution.pollId,
      quorum,
      ballots: ballots.map((b) => ({
        id: b.id,
        unitId: b.unitId,
        unitIdentifier: b.unit.identifier,
        optionId: b.optionId,
        optionLabel: b.option.label,
        weight: Number(b.weight),
        viaProxy: b.viaProxy,
        proxyId: b.proxyId,
        ownerUserId: b.ownerUserId,
        castByUserId: b.userId,
        castByName: b.user.name,
        castByEmail: b.user.email,
        castAt: b.createdAt,
        immutable: true,
      })),
    };
  }

  async getMeetingQuorum(user: AuthenticatedUser, meetingId: string) {
    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException();
    this.assertCondoAccess(user, meeting.condoId);
    if (
      !this.isManagementForCondo(user, meeting.condoId) &&
      meeting.status === GeneralMeetingStatus.DRAFT
    ) {
      throw new NotFoundException();
    }

    return this.computeQuorumBaseline(meeting.condoId, Number(meeting.quorumPercent));
  }

  async submitProxy(user: AuthenticatedUser, meetingId: string, dto: SubmitMeetingProxyDto) {
    if (!this.canSubmitProxy(user)) {
      throw new ForbiddenException('Only unit owners may submit meeting proxies');
    }

    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException();

    if (
      meeting.status !== GeneralMeetingStatus.NOTICE_PUBLISHED &&
      meeting.status !== GeneralMeetingStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('Proxies can only be submitted after the notice is published');
    }

    const now = new Date();
    const ownership = await this.prisma.ownership.findFirst({
      where: {
        userId: user.id,
        unitId: dto.unitId,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { unit: { select: { condoId: true } } },
    });
    if (!ownership) {
      throw new ForbiddenException('You do not have active ownership on the selected unit');
    }
    if (ownership.unit.condoId !== meeting.condoId) {
      throw new BadRequestException('Unit does not belong to this meeting');
    }

    const proxyHolderUserId = await this.resolveProxyHolderUserId(
      meeting.condoId,
      dto.proxyHolderUserId,
      dto.proxyHolderContact,
    );

    try {
      const proxy = await this.prisma.meetingProxy.create({
        data: {
          meetingId,
          unitId: dto.unitId,
          ownerUserId: user.id,
          proxyHolderUserId,
          proxyHolderName: dto.proxyHolderName.trim(),
          proxyHolderContact: dto.proxyHolderContact?.trim() ?? '',
        },
        include: {
          unit: { select: { id: true, identifier: true } },
        },
      });

      this.events.emit('governance.proxy.submitted', {
        proxyId: proxy.id,
        meetingId,
        condoId: meeting.condoId,
        ownerUserId: user.id,
        unitId: dto.unitId,
        proxyHolderUserId,
      });

      return {
        id: proxy.id,
        meetingId: proxy.meetingId,
        unitId: proxy.unitId,
        unitIdentifier: proxy.unit.identifier,
        proxyHolderUserId: proxy.proxyHolderUserId,
        proxyHolderName: proxy.proxyHolderName,
        proxyHolderContact: proxy.proxyHolderContact,
        submittedAt: proxy.submittedAt,
      };
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('A proxy has already been submitted for this unit');
      }
      throw err;
    }
  }

  async getMyProxies(user: AuthenticatedUser, meetingId: string) {
    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException();
    this.assertCondoAccess(user, meeting.condoId);
    return this.fetchMyProxies(user.id, meetingId);
  }

  async listMeetingProxies(user: AuthenticatedUser, meetingId: string) {
    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException();
    this.assertManagement(user, meeting.condoId);

    const rows = await this.prisma.meetingProxy.findMany({
      where: { meetingId },
      include: {
        unit: { select: { id: true, identifier: true } },
        owner: { select: { id: true, name: true, email: true } },
        proxyHolder: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ submittedAt: 'asc' }],
    });

    return rows.map((p) => ({
      id: p.id,
      meetingId: p.meetingId,
      unitId: p.unitId,
      unitIdentifier: p.unit.identifier,
      ownerUserId: p.ownerUserId,
      ownerName: p.owner.name,
      ownerEmail: p.owner.email,
      proxyHolderUserId: p.proxyHolderUserId,
      proxyHolderName: p.proxyHolderName,
      proxyHolderContact: p.proxyHolderContact,
      proxyHolderAccountName: p.proxyHolder?.name ?? null,
      submittedAt: p.submittedAt,
    }));
  }

  private async fetchMyProxies(userId: string, meetingId: string) {
    const rows = await this.prisma.meetingProxy.findMany({
      where: { meetingId, ownerUserId: userId },
      include: { unit: { select: { id: true, identifier: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      meetingId: p.meetingId,
      unitId: p.unitId,
      unitIdentifier: p.unit.identifier,
      proxyHolderUserId: p.proxyHolderUserId,
      proxyHolderName: p.proxyHolderName,
      proxyHolderContact: p.proxyHolderContact,
      submittedAt: p.submittedAt,
    }));
  }

  private async fetchMyProxyAssignments(user: AuthenticatedUser, meetingId: string) {
    const meeting = await this.prisma.generalMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return [];

    const rows = await this.prisma.meetingProxy.findMany({
      where: {
        meetingId,
        OR: [
          { proxyHolderUserId: user.id },
          ...(user.email
            ? [{ proxyHolderContact: { equals: user.email, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      include: {
        unit: { select: { id: true, identifier: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return rows.map((p) => ({
      id: p.id,
      meetingId: p.meetingId,
      unitId: p.unitId,
      unitIdentifier: p.unit.identifier,
      ownerUserId: p.ownerUserId,
      ownerName: p.owner.name,
      proxyHolderName: p.proxyHolderName,
      submittedAt: p.submittedAt,
    }));
  }

  private async buildEligibilitySnapshot(condoId: string) {
    const now = new Date();
    const ownerships = await this.prisma.ownership.findMany({
      where: {
        status: 'ACTIVE',
        unit: { condoId },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: {
        unit: { select: { id: true, identifier: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ unit: { identifier: 'asc' } }, { sharePercent: 'desc' }],
    });

    const byUnit = new Map<
      string,
      {
        unitId: string;
        unitIdentifier: string;
        sharePercent: number;
        ownerUserId: string;
        ownerName: string;
      }
    >();
    for (const o of ownerships) {
      const share = Number(o.sharePercent);
      const existing = byUnit.get(o.unitId);
      if (!existing || share > existing.sharePercent) {
        byUnit.set(o.unitId, {
          unitId: o.unitId,
          unitIdentifier: o.unit.identifier,
          sharePercent: share,
          ownerUserId: o.userId,
          ownerName: o.user.name,
        });
      }
    }

    const units = [...byUnit.values()];
    const totalShareWeight = units.reduce((s, u) => s + u.sharePercent, 0);

    return {
      capturedAt: now.toISOString(),
      unitCount: units.length,
      totalShareWeight: Math.round(totalShareWeight * 1000) / 1000,
      units,
    };
  }

  private async computeQuorumBaseline(condoId: string, quorumPercent: number) {
    const now = new Date();
    const ownerships = await this.prisma.ownership.findMany({
      where: {
        status: 'ACTIVE',
        unit: { condoId },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      select: { unitId: true, sharePercent: true },
    });

    // One share weight per unit (primary / max share if multiple owners)
    const byUnit = new Map<string, number>();
    for (const o of ownerships) {
      const share = Number(o.sharePercent);
      const prev = byUnit.get(o.unitId) ?? 0;
      if (share > prev) byUnit.set(o.unitId, share);
    }

    const eligibleUnitCount = byUnit.size;
    const eligibleShareWeight = [...byUnit.values()].reduce((s, w) => s + w, 0);

    return {
      quorumPercent,
      eligibleUnitCount,
      eligibleShareWeight: Math.round(eligibleShareWeight * 1000) / 1000,
      castUnitCount: 0,
      castShareWeight: 0,
      castSharePercentOfEligible:
        eligibleShareWeight > 0 ? 0 : eligibleShareWeight === 0 && quorumPercent === 0 ? 100 : 0,
      met: quorumPercent <= 0,
    };
  }

  private async computeQuorumForPoll(condoId: string, pollId: string, quorumPercent: number) {
    const baseline = await this.computeQuorumBaseline(condoId, quorumPercent);
    const votes = await this.prisma.pollVote.findMany({
      where: { pollId },
      select: { unitId: true, weight: true },
    });

    const castUnitCount = votes.length;
    const castShareWeight = votes.reduce((s, v) => s + Number(v.weight), 0);
    const castSharePercentOfEligible =
      baseline.eligibleShareWeight > 0
        ? Math.round((castShareWeight / baseline.eligibleShareWeight) * 100_000) / 1000
        : castUnitCount > 0
          ? 100
          : 0;

    return {
      ...baseline,
      castUnitCount,
      castShareWeight: Math.round(castShareWeight * 1000) / 1000,
      castSharePercentOfEligible,
      met: castSharePercentOfEligible + 1e-9 >= quorumPercent,
    };
  }

  private serializeMeeting(
    row: Prisma.GeneralMeetingGetPayload<{ include: typeof meetingInclude }> & {
      minutesBody?: string;
      minutesPublishedAt?: Date | null;
      financialSnapshot?: unknown;
      quorumPercent?: Prisma.Decimal | number;
    },
    _user: AuthenticatedUser,
    opts: { manage?: boolean },
  ) {
    const showMinutes = opts.manage || row.minutesPublishedAt != null;
    const showFinancial = opts.manage || row.status !== GeneralMeetingStatus.DRAFT;

    return {
      id: row.id,
      condoId: row.condoId,
      kind: row.kind,
      title: row.title,
      scheduledAt: row.scheduledAt,
      noticeBody: opts.manage || row.status !== GeneralMeetingStatus.DRAFT ? row.noticeBody : '',
      minutesBody: showMinutes ? (row.minutesBody ?? '') : '',
      minutesPublishedAt: row.minutesPublishedAt ?? null,
      financialSnapshot: showFinancial
        ? ((row.financialSnapshot as MeetingFinancialSnapshot | null) ?? null)
        : null,
      quorumPercent: Number(row.quorumPercent ?? 50),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      resolutionCount: row.resolutions.length,
      proxyCount: row._count.proxies,
    };
  }

  private async serializeResolution(
    row: {
      id: string;
      meetingId: string;
      title: string;
      description: string;
      pollId: string | null;
      votingOpensAt: Date | null;
      votingClosesAt: Date | null;
      eligibilitySnapshot?: Prisma.JsonValue | null;
      resultsSnapshot?: Prisma.JsonValue | null;
      position: number;
      poll?: { id: string; status: PollStatus; opensAt: Date | null; closesAt: Date | null } | null;
    },
    user: AuthenticatedUser,
    opts: { manage?: boolean; includePollDetail?: boolean; includeBreakdown?: boolean },
  ) {
    const pollStatus = row.poll?.status;
    const pollOpen = pollStatus === PollStatus.OPEN;
    const pollClosed = pollStatus === PollStatus.CLOSED;
    const needsPollDetail =
      opts.includePollDetail || opts.manage || pollOpen || pollClosed || !!row.resultsSnapshot;

    let pollSummary = null;
    if (row.pollId && needsPollDetail) {
      const poll = await this.polls.getOne(user, row.pollId, { manage: opts.manage });
      const snapshotResults = row.resultsSnapshot
        ? (row.resultsSnapshot as Record<string, unknown>)
        : null;

      pollSummary = {
        id: poll.id,
        status: poll.status,
        opensAt: poll.opensAt,
        closesAt: poll.closesAt,
        options: poll.options,
        results: pollClosed && snapshotResults ? snapshotResults : poll.results,
        myVotes: poll.myVotes,
      };
    } else if (row.poll) {
      pollSummary = {
        id: row.poll.id,
        status: row.poll.status,
        opensAt: row.poll.opensAt,
        closesAt: row.poll.closesAt,
      };
    }

    return {
      id: row.id,
      meetingId: row.meetingId,
      title: row.title,
      description: row.description,
      pollId: row.pollId,
      votingOpensAt: row.votingOpensAt,
      votingClosesAt: row.votingClosesAt,
      position: row.position,
      poll: pollSummary,
      eligibilitySnapshot:
        opts.manage || pollOpen || pollClosed
          ? ((row.eligibilitySnapshot as Record<string, unknown> | null | undefined) ?? undefined)
          : undefined,
      resultsSnapshot: pollClosed && row.resultsSnapshot ? row.resultsSnapshot : undefined,
    };
  }

  private isProxyHolder(
    user: AuthenticatedUser,
    proxy: { proxyHolderUserId: string | null; proxyHolderContact: string },
  ): boolean {
    if (proxy.proxyHolderUserId && proxy.proxyHolderUserId === user.id) return true;
    const contact = proxy.proxyHolderContact.trim().toLowerCase();
    return contact.length > 0 && user.email != null && contact === user.email.trim().toLowerCase();
  }

  private async resolveProxyHolderUserId(
    condoId: string,
    explicitUserId?: string,
    contact?: string,
  ): Promise<string | null> {
    if (explicitUserId) {
      const holder = await this.prisma.user.findUnique({
        where: { id: explicitUserId },
        include: { roleAssignments: { where: { condoId } } },
      });
      if (!holder || holder.roleAssignments.length === 0) {
        throw new BadRequestException('Proxy holder must be a registered resident in this condo');
      }
      return holder.id;
    }

    const email = contact?.trim();
    if (email?.includes('@')) {
      const holder = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { roleAssignments: { where: { condoId } } },
      });
      if (holder && holder.roleAssignments.length > 0) {
        return holder.id;
      }
    }

    return null;
  }

  private canSubmitProxy(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => r.roleId === RoleId.UNIT_OWNER);
  }

  private isManagementForCondo(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.SUPER_ADMIN) &&
        (r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN),
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagementForCondo(user, condoId)) {
      throw new ForbiddenException('Management access required');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const hasAccess = user.roles.some(
      (r) => r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN,
    );
    if (!hasAccess) throw new ForbiddenException('No access to this condo');
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    );
  }
}
