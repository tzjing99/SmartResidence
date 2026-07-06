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

    const resolutions = await Promise.all(
      row.resolutions.map((res) => this.serializeResolution(res, user, { manage })),
    );

    return {
      ...this.serializeMeeting(row, user, { manage }),
      resolutions,
      myProxies,
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

    const row = await this.prisma.generalMeeting.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title?.trim(),
        scheduledAt: dto.scheduledAt,
        noticeBody: dto.noticeBody?.trim(),
        minutesBody: dto.minutesBody?.trim(),
        status: dto.status,
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
      include: { meeting: true, poll: true },
    });
    if (!resolution) throw new NotFoundException();
    this.assertManagement(user, resolution.meeting.condoId);

    if (!resolution.pollId || !resolution.poll) {
      throw new BadRequestException('Voting is not open for this resolution');
    }
    if (resolution.poll.status === PollStatus.CLOSED) {
      throw new BadRequestException('Voting is already closed');
    }

    await this.prisma.poll.update({
      where: { id: resolution.pollId },
      data: { status: PollStatus.CLOSED },
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
    return {
      resolutionId: resolution.id,
      title: resolution.title,
      pollId: resolution.pollId,
      votingOpensAt: resolution.votingOpensAt,
      votingClosesAt: resolution.votingClosesAt,
      poll,
    };
  }

  async castResolutionVote(
    user: AuthenticatedUser,
    resolutionId: string,
    dto: CastResolutionVoteDto,
  ) {
    const resolution = await this.prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { meeting: true },
    });
    if (!resolution) throw new NotFoundException();
    if (!resolution.pollId) {
      throw new BadRequestException('Voting is not open for this resolution');
    }

    return this.polls.castVote(user, resolution.pollId, dto);
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

    try {
      const proxy = await this.prisma.meetingProxy.create({
        data: {
          meetingId,
          unitId: dto.unitId,
          ownerUserId: user.id,
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
      });

      return {
        id: proxy.id,
        meetingId: proxy.meetingId,
        unitId: proxy.unitId,
        unitIdentifier: proxy.unit.identifier,
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
      proxyHolderName: p.proxyHolderName,
      proxyHolderContact: p.proxyHolderContact,
      submittedAt: p.submittedAt,
    }));
  }

  private serializeMeeting(
    row: Prisma.GeneralMeetingGetPayload<{ include: typeof meetingInclude }> & {
      minutesBody?: string;
      minutesPublishedAt?: Date | null;
      financialSnapshot?: unknown;
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
      position: number;
      poll?: { id: string; status: PollStatus; opensAt: Date | null; closesAt: Date | null } | null;
    },
    user: AuthenticatedUser,
    opts: { manage?: boolean; includePollDetail?: boolean; includeBreakdown?: boolean },
  ) {
    let pollSummary = null;
    if (row.pollId && (opts.includePollDetail || opts.manage)) {
      const poll = await this.polls.getOne(user, row.pollId, { manage: opts.manage });
      pollSummary = {
        id: poll.id,
        status: poll.status,
        opensAt: poll.opensAt,
        closesAt: poll.closesAt,
        options: poll.options,
        results: poll.results,
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
    };
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
