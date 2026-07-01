import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  type Poll,
  PollAudienceScope,
  type PollOption,
  PollStatus,
  type Prisma,
  RoleId,
} from '@prisma/client';
import type { CastPollVoteDto, CreatePollDto, UpdatePollDto } from './dto/polls.dto';

function effectivePollStatus(
  poll: { status: PollStatus; closesAt?: Date | null },
  now: Date = new Date(),
): PollStatus {
  if (
    poll.status === PollStatus.OPEN &&
    poll.closesAt &&
    poll.closesAt.getTime() <= now.getTime()
  ) {
    return PollStatus.CLOSED;
  }
  return poll.status;
}

type PollRow = Poll & {
  createdBy: { id: string; name: string };
  options: PollOption[];
};

const pollInclude = {
  createdBy: { select: { id: true, name: true } },
  options: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PollInclude;

const RECENTLY_CLOSED_DAYS = 90;

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number; manage?: boolean },
  ) {
    this.assertCondoAccess(user, condoId);
    const manage = opts.manage === true && this.isManagementForCondo(user, condoId);
    const now = new Date();

    const where: Prisma.PollWhereInput = { condoId };

    if (manage) {
      // Management sees all polls including drafts.
    } else {
      const recentCutoff = new Date(now);
      recentCutoff.setDate(recentCutoff.getDate() - RECENTLY_CLOSED_DAYS);
      where.OR = [
        { status: PollStatus.OPEN },
        {
          status: PollStatus.CLOSED,
          OR: [{ closesAt: { gte: recentCutoff } }, { updatedAt: { gte: recentCutoff } }],
        },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.poll.findMany({
        where,
        include: pollInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.poll.count({ where }),
    ]);

    await Promise.all(rows.map((row) => this.maybeAutoClose(row)));

    return {
      items: rows.map((row) =>
        this.serialize(row as PollRow, user, {
          manage,
          includeResults: false,
          includeMyVotes: false,
        }),
      ),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async getOne(user: AuthenticatedUser, id: string, opts?: { manage?: boolean }) {
    const row = await this.prisma.poll.findUnique({
      where: { id },
      include: pollInclude,
    });
    if (!row) throw new NotFoundException();

    this.assertCondoAccess(user, row.condoId);
    const manage = opts?.manage ?? this.isManagementForCondo(user, row.condoId);
    const status = await this.maybeAutoClose(row);

    if (!manage && status === PollStatus.DRAFT) {
      throw new NotFoundException();
    }

    const includeResults = status === PollStatus.OPEN || status === PollStatus.CLOSED;
    const includeBreakdown = status === PollStatus.CLOSED;

    return this.serialize(row as PollRow, user, {
      manage,
      includeResults,
      includeBreakdown,
      includeMyVotes: true,
    });
  }

  async create(user: AuthenticatedUser, dto: CreatePollDto) {
    this.assertManagement(user, dto.condoId);
    this.validateSchedule(dto.opensAt, dto.closesAt);
    this.validateAudience(dto.audienceScope, dto.blockIds);

    const poll = await this.prisma.poll.create({
      data: {
        condoId: dto.condoId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        opensAt: dto.opensAt ?? null,
        closesAt: dto.closesAt ?? null,
        createdByUserId: user.id,
        audienceScope: dto.audienceScope ?? PollAudienceScope.ALL_OWNERS,
        blockIds: dto.blockIds ?? [],
        options: {
          create: dto.options.map((opt, idx) => ({
            label: opt.label.trim(),
            position: opt.position ?? idx,
          })),
        },
      },
      include: pollInclude,
    });

    return this.serialize(poll as PollRow, user, { manage: true, includeResults: false });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdatePollDto) {
    const existing = await this.prisma.poll.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!existing) throw new NotFoundException();
    this.assertManagement(user, existing.condoId);

    const effective = effectivePollStatus(existing);
    if (effective !== PollStatus.DRAFT && dto.options) {
      throw new BadRequestException('Options can only be edited while the poll is a draft');
    }
    if (effective === PollStatus.CLOSED && dto.status !== PollStatus.CLOSED) {
      throw new BadRequestException('Closed polls cannot be reopened');
    }

    if (dto.opensAt !== undefined || dto.closesAt !== undefined) {
      this.validateSchedule(
        dto.opensAt ?? existing.opensAt ?? undefined,
        dto.closesAt ?? existing.closesAt ?? undefined,
      );
    }
    if (dto.audienceScope !== undefined || dto.blockIds !== undefined) {
      this.validateAudience(
        dto.audienceScope ?? existing.audienceScope,
        dto.blockIds ?? this.parseBlockIds(existing.blockIds),
      );
    }

    if (dto.status === PollStatus.OPEN) {
      const opensAt = dto.opensAt ?? existing.opensAt ?? new Date();
      if (!existing.options.length && !dto.options?.length) {
        throw new BadRequestException('Poll must have at least two options before opening');
      }
      dto.opensAt = opensAt;
    }

    const poll = await this.prisma.$transaction(async (tx) => {
      if (dto.options && effective === PollStatus.DRAFT) {
        await tx.pollOption.deleteMany({ where: { pollId: id } });
        await tx.pollOption.createMany({
          data: dto.options.map((opt, idx) => ({
            pollId: id,
            label: opt.label.trim(),
            position: opt.position ?? idx,
          })),
        });
      }

      return tx.poll.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          opensAt: dto.opensAt === null ? null : dto.opensAt,
          closesAt: dto.closesAt === null ? null : dto.closesAt,
          audienceScope: dto.audienceScope,
          blockIds: dto.blockIds,
          status: dto.status,
        },
        include: pollInclude,
      });
    });

    return this.serialize(poll as PollRow, user, {
      manage: true,
      includeResults: effectivePollStatus(poll) !== PollStatus.DRAFT,
      includeBreakdown: effectivePollStatus(poll) === PollStatus.CLOSED,
    });
  }

  async castVote(user: AuthenticatedUser, pollId: string, dto: CastPollVoteDto) {
    if (!this.canVote(user)) {
      throw new ForbiddenException('Only unit owners may vote on governance polls');
    }

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException();

    const status = await this.maybeAutoClose(poll);
    if (status !== PollStatus.OPEN) {
      throw new BadRequestException('This poll is not open for voting');
    }

    const now = new Date();
    if (poll.opensAt && poll.opensAt.getTime() > now.getTime()) {
      throw new BadRequestException('Voting has not opened yet');
    }
    if (poll.closesAt && poll.closesAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Voting has closed');
    }

    const option = poll.options.find((o) => o.id === dto.optionId);
    if (!option) throw new BadRequestException('Invalid poll option');

    const ownership = await this.prisma.ownership.findFirst({
      where: {
        userId: user.id,
        unitId: dto.unitId,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { unit: { select: { id: true, condoId: true, blockId: true, identifier: true } } },
    });
    if (!ownership) {
      throw new ForbiddenException('You do not have active ownership on the selected unit');
    }
    if (ownership.unit.condoId !== poll.condoId) {
      throw new BadRequestException('Unit does not belong to this poll');
    }

    if (!this.unitMatchesAudience(poll, ownership.unit.blockId)) {
      throw new BadRequestException('This unit is not in the poll audience');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.pollVote.create({
          data: {
            pollId,
            optionId: dto.optionId,
            unitId: dto.unitId,
            userId: user.id,
            ownershipId: ownership.id,
            weight: ownership.sharePercent,
          },
        });

        await tx.auditLog.create({
          data: {
            condoId: poll.condoId,
            unitId: dto.unitId,
            actorUserId: user.id,
            actorRole: user.activeRole ?? undefined,
            action: AuditAction.CREATE,
            resourceType: 'PollVote',
            resourceId: pollId,
            metadata: {
              optionId: dto.optionId,
              optionLabel: option.label,
              ownershipId: ownership.id,
              weight: Number(ownership.sharePercent),
            },
          },
        });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('This unit has already voted in this poll');
      }
      throw err;
    }

    return this.getMyVotes(user, pollId);
  }

  async getMyVotes(user: AuthenticatedUser, pollId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException();
    this.assertCondoAccess(user, poll.condoId);

    const votes = await this.prisma.pollVote.findMany({
      where: { pollId, userId: user.id },
      include: {
        option: { select: { id: true, label: true } },
        unit: { select: { id: true, identifier: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return votes.map((v) => ({
      unitId: v.unitId,
      unitIdentifier: v.unit.identifier,
      optionId: v.optionId,
      optionLabel: v.option.label,
      weight: Number(v.weight),
      votedAt: v.createdAt,
    }));
  }

  /** Close polls whose closesAt has passed. Returns count closed. */
  async closeExpiredPolls(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.poll.updateMany({
      where: {
        status: PollStatus.OPEN,
        closesAt: { lte: now },
      },
      data: { status: PollStatus.CLOSED },
    });
    return result.count;
  }

  private async maybeAutoClose(poll: Poll): Promise<PollStatus> {
    const effective = effectivePollStatus(poll);
    if (poll.status === PollStatus.OPEN && effective === PollStatus.CLOSED) {
      await this.prisma.poll.update({
        where: { id: poll.id },
        data: { status: PollStatus.CLOSED },
      });
      return PollStatus.CLOSED;
    }
    return poll.status;
  }

  private async serialize(
    row: PollRow,
    user: AuthenticatedUser,
    opts: {
      manage?: boolean;
      includeResults?: boolean;
      includeBreakdown?: boolean;
      includeMyVotes?: boolean;
    },
  ) {
    const status = effectivePollStatus(row);
    const blockIds = this.parseBlockIds(row.blockIds);

    let results = null;
    if (opts.includeResults && status !== PollStatus.DRAFT) {
      results = await this.computeResults(row.id, row.options, opts.includeBreakdown === true);
    }

    let myVotes: Awaited<ReturnType<PollsService['getMyVotes']>> | undefined;
    if (opts.includeMyVotes !== false && this.canVote(user)) {
      myVotes = await this.getMyVotes(user, row.id);
    }

    return {
      id: row.id,
      condoId: row.condoId,
      title: row.title,
      description: row.description,
      status,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      audienceScope: row.audienceScope,
      blockIds,
      settings: (row.settings as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      options: row.options.map((o) => ({
        id: o.id,
        pollId: o.pollId,
        label: o.label,
        position: o.position,
      })),
      results,
      myVotes,
    };
  }

  private async computeResults(pollId: string, options: PollOption[], includeBreakdown: boolean) {
    const votes = await this.prisma.pollVote.findMany({
      where: { pollId },
      include: {
        option: { select: { id: true, label: true } },
        unit: { select: { id: true, identifier: true } },
      },
    });

    const totalVotes = votes.length;
    const totalWeight = votes.reduce((sum, v) => sum + Number(v.weight), 0);

    const byOption = new Map<string, { count: number; weight: number }>();
    for (const opt of options) {
      byOption.set(opt.id, { count: 0, weight: 0 });
    }
    for (const v of votes) {
      const bucket = byOption.get(v.optionId) ?? { count: 0, weight: 0 };
      bucket.count += 1;
      bucket.weight += Number(v.weight);
      byOption.set(v.optionId, bucket);
    }

    return {
      totalVotes,
      totalWeight,
      options: options.map((opt) => {
        const bucket = byOption.get(opt.id) ?? { count: 0, weight: 0 };
        return {
          id: opt.id,
          pollId: opt.pollId,
          label: opt.label,
          position: opt.position,
          voteCount: bucket.count,
          weightSum: bucket.weight,
          votePercent: totalVotes > 0 ? Math.round((bucket.count / totalVotes) * 1000) / 10 : 0,
          weightPercent:
            totalWeight > 0 ? Math.round((bucket.weight / totalWeight) * 1000) / 10 : 0,
        };
      }),
      breakdown: includeBreakdown
        ? votes.map((v) => ({
            unitId: v.unitId,
            unitIdentifier: v.unit.identifier,
            optionId: v.optionId,
            optionLabel: v.option.label,
            weight: Number(v.weight),
            votedAt: v.createdAt,
          }))
        : undefined,
    };
  }

  private unitMatchesAudience(poll: Poll, blockId: string): boolean {
    if (poll.audienceScope === PollAudienceScope.ALL_OWNERS) return true;
    const blockIds = this.parseBlockIds(poll.blockIds);
    return blockIds.includes(blockId);
  }

  private parseBlockIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }

  private validateSchedule(opensAt?: Date | null, closesAt?: Date | null) {
    if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) {
      throw new BadRequestException('closesAt must be after opensAt');
    }
  }

  private validateAudience(scope?: PollAudienceScope, blockIds?: string[]) {
    if (scope === PollAudienceScope.BLOCK && (!blockIds || blockIds.length === 0)) {
      throw new BadRequestException('blockIds required when audienceScope is BLOCK');
    }
  }

  private canVote(user: AuthenticatedUser): boolean {
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
