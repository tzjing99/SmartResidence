import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type Announcement,
  AnnouncementAudienceScope,
  type Attachment,
  AttachmentOwner,
  AttachmentStatus,
  type Prisma,
  RoleId,
  type User,
} from '@prisma/client';
import type { AnnouncementCategory } from '@prisma/client';
import { announcementStatus, isPdfMime } from '@smartresidence/shared-types';
import {
  announcementMatchesResident,
  audienceWhereForResident,
  formatAudienceSummary,
  isManagementForCondo,
  residentAudienceFromRoles,
  resolveAnnouncementRecipientUserIds,
} from './announcement-audience';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

type AnnouncementRow = Announcement & {
  author: Pick<User, 'id' | 'name'>;
  attachments: Attachment[];
  blocks: Array<{ blockId: string; block: { id: string; name: string } }>;
  units: Array<{ unitId: string; unit: { id: string; identifier: string } }>;
  _count: { acks: number; reads: number };
  acks?: { userId: string }[];
  reads?: { userId: string }[];
};

const listInclude = {
  author: { select: { id: true, name: true } },
  attachments: {
    where: { status: AttachmentStatus.COMMITTED },
    orderBy: { createdAt: 'asc' as const },
  },
  blocks: { include: { block: { select: { id: true, name: true } } } },
  units: { include: { unit: { select: { id: true, identifier: true } } } },
  _count: { select: { acks: true, reads: true } },
} satisfies Prisma.AnnouncementInclude;

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    user: AuthenticatedUser,
    condoId: string,
    opts: {
      limit: number;
      offset: number;
      manage?: boolean;
      category?: AnnouncementCategory;
      includeStats?: boolean;
    },
  ) {
    const now = new Date();
    const manage = Boolean(opts.manage) && isManagementForCondo(user, condoId);
    const where: Prisma.AnnouncementWhereInput = {
      condoId,
      deletedAt: null,
    };

    if (opts.category) {
      where.category = opts.category;
    }

    if (manage) {
      where.OR = [{ publishedAt: { not: null } }, { publishedAt: null }];
    } else {
      if (!user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId)) {
        throw new ForbiddenException('You cannot view announcements for this condo');
      }
      where.publishedAt = { not: null, lte: now };
      const audienceCtx = await this.getResidentAudienceContext(user, condoId);
      where.AND = [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        audienceWhereForResident(audienceCtx),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: {
          ...listInclude,
          acks: { where: { userId: user.id }, select: { userId: true }, take: 1 },
          reads: { where: { userId: user.id }, select: { userId: true }, take: 1 },
        },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    const includeStats = manage && opts.includeStats === true;
    const statsById = includeStats
      ? await this.batchReadStats(
          items as Array<
            AnnouncementRow & {
              blocks: Array<{ blockId: string }>;
              units: Array<{ unitId: string }>;
            }
          >,
          condoId,
        )
      : null;

    return {
      items: items.map((row) =>
        this.serialize(row as AnnouncementRow, user.id, {
          manage,
          readStats: statsById?.get(row.id),
        }),
      ),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async getOne(user: AuthenticatedUser, id: string, opts?: { manage?: boolean }) {
    const row = await this.prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...listInclude,
        acks: { where: { userId: user.id }, select: { userId: true }, take: 1 },
        reads: { where: { userId: user.id }, select: { userId: true }, take: 1 },
      },
    });
    if (!row) throw new NotFoundException();

    const manage = opts?.manage ?? isManagementForCondo(user, row.condoId);
    if (!manage) {
      if (announcementStatus(row) !== 'PUBLISHED') {
        throw new NotFoundException();
      }
      const audienceCtx = await this.getResidentAudienceContext(user, row.condoId);
      if (!announcementMatchesResident(row, audienceCtx)) {
        throw new NotFoundException();
      }
    }

    return this.serialize(row as AnnouncementRow, user.id, { manage });
  }

  async getReadStats(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      include: {
        blocks: { select: { blockId: true } },
        units: { select: { unitId: true } },
      },
    });
    if (!row) throw new NotFoundException();
    if (!isManagementForCondo(user, row.condoId)) {
      throw new NotFoundException();
    }

    const recipientIds = await resolveAnnouncementRecipientUserIds(this.prisma, row, row.condoId);
    const recipientCount = recipientIds.length;

    const [readCount, ackCount] =
      recipientCount === 0
        ? [0, 0]
        : await this.prisma.$transaction([
            this.prisma.announcementRead.count({
              where: { announcementId: id, userId: { in: recipientIds } },
            }),
            this.prisma.announcementAck.count({
              where: { announcementId: id, userId: { in: recipientIds } },
            }),
          ]);

    const pct = (n: number) => (recipientCount > 0 ? Math.round((n / recipientCount) * 100) : 0);

    return {
      recipientCount,
      readCount,
      ackCount,
      readPercent: pct(readCount),
      ackPercent: pct(ackCount),
    };
  }

  private async batchReadStats(
    rows: Array<
      AnnouncementRow & {
        audienceScope: Announcement['audienceScope'];
        blocks: Array<{ blockId: string }>;
        units: Array<{ unitId: string }>;
      }
    >,
    condoId: string,
  ) {
    const statsById = new Map<
      string,
      { recipientCount: number; readCount: number; readPercent: number }
    >();
    if (rows.length === 0) return statsById;

    const condoUnits = await this.prisma.unit.findMany({
      where: { condoId },
      select: { id: true, blockId: true },
    });
    const condoUnitIds = condoUnits.map((u) => u.id);
    const unitIdsByBlock = new Map<string, string[]>();
    for (const unit of condoUnits) {
      const list = unitIdsByBlock.get(unit.blockId) ?? [];
      list.push(unit.id);
      unitIdsByBlock.set(unit.blockId, list);
    }

    const unitIdsByAnnouncement = new Map<string, string[]>();
    const allUnitIdsNeeded = new Set<string>();
    for (const row of rows) {
      let unitIds: string[];
      switch (row.audienceScope) {
        case AnnouncementAudienceScope.CONDO:
          unitIds = condoUnitIds;
          break;
        case AnnouncementAudienceScope.BLOCKS:
          unitIds = row.blocks.flatMap((b) => unitIdsByBlock.get(b.blockId) ?? []);
          break;
        case AnnouncementAudienceScope.UNITS:
          unitIds = row.units.map((u) => u.unitId);
          break;
        default:
          unitIds = [];
      }
      for (const id of unitIds) allUnitIdsNeeded.add(id);
      unitIdsByAnnouncement.set(row.id, unitIds);
    }

    const unitIdList = [...allUnitIdsNeeded];
    const [ownerships, tenancies, roles] =
      unitIdList.length === 0
        ? [[], [], []]
        : await Promise.all([
            this.prisma.ownership.findMany({
              where: { unitId: { in: unitIdList }, status: 'ACTIVE' },
              select: { unitId: true, userId: true },
            }),
            this.prisma.tenancy.findMany({
              where: { unitId: { in: unitIdList }, status: 'ACTIVE' },
              select: { unitId: true, userId: true },
            }),
            this.prisma.roleAssignment.findMany({
              where: { condoId, unitId: { in: unitIdList }, revokedAt: null },
              select: { unitId: true, userId: true },
            }),
          ]);

    const usersByUnit = new Map<string, Set<string>>();
    const linkUser = (unitId: string | null, userId: string) => {
      if (!unitId) return;
      const set = usersByUnit.get(unitId) ?? new Set<string>();
      set.add(userId);
      usersByUnit.set(unitId, set);
    };
    for (const row of [...ownerships, ...tenancies, ...roles]) {
      linkUser(row.unitId, row.userId);
    }

    const recipientIdsByAnnouncement = new Map<string, string[]>();
    for (const row of rows) {
      const unitIds = unitIdsByAnnouncement.get(row.id) ?? [];
      const recipientIds = new Set<string>();
      for (const unitId of unitIds) {
        for (const userId of usersByUnit.get(unitId) ?? []) {
          recipientIds.add(userId);
        }
      }
      recipientIdsByAnnouncement.set(row.id, [...recipientIds]);
    }

    const allRecipientIds = [...new Set([...recipientIdsByAnnouncement.values()].flat())];
    const reads =
      allRecipientIds.length === 0
        ? []
        : await this.prisma.announcementRead.findMany({
            where: {
              announcementId: { in: rows.map((r) => r.id) },
              userId: { in: allRecipientIds },
            },
            select: { announcementId: true, userId: true },
          });

    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    for (const row of rows) {
      const recipientIds = recipientIdsByAnnouncement.get(row.id) ?? [];
      const recipientSet = new Set(recipientIds);
      const readCount = reads.filter(
        (r) => r.announcementId === row.id && recipientSet.has(r.userId),
      ).length;
      statsById.set(row.id, {
        recipientCount: recipientIds.length,
        readCount,
        readPercent: pct(readCount, recipientIds.length),
      });
    }

    return statsById;
  }

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto) {
    if (!isManagementForCondo(user, dto.condoId)) {
      throw new ForbiddenException('Only management can publish announcements for this condo');
    }
    if (dto.attachmentIds?.length) {
      await this.validateAttachments(user.id, dto.attachmentIds);
    }
    const audienceScope = dto.audienceScope ?? AnnouncementAudienceScope.CONDO;
    await this.validateAudience(dto.condoId, audienceScope, dto.blockIds, dto.unitIds);

    const publishedAt = dto.publishedAt ?? new Date();
    this.validateSchedule(publishedAt, dto.expiresAt ?? null);

    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          condoId: dto.condoId,
          authorUserId: user.id,
          title: dto.title,
          body: dto.body,
          importance: dto.importance ?? 'INFO',
          category: dto.category ?? 'DOCUMENT',
          audienceScope,
          audience: {},
          publishedAt,
          expiresAt: dto.expiresAt,
          requiresAck: dto.requiresAck ?? false,
          pinned: dto.pinned ?? false,
        },
      });

      if (audienceScope === AnnouncementAudienceScope.BLOCKS && dto.blockIds?.length) {
        await tx.announcementBlock.createMany({
          data: dto.blockIds.map((blockId) => ({ announcementId: created.id, blockId })),
        });
      }
      if (audienceScope === AnnouncementAudienceScope.UNITS && dto.unitIds?.length) {
        await tx.announcementUnit.createMany({
          data: dto.unitIds.map((unitId) => ({ announcementId: created.id, unitId })),
        });
      }

      if (dto.attachmentIds?.length) {
        await tx.attachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            uploadedByUserId: user.id,
            ownerKind: AttachmentOwner.GENERIC,
            status: AttachmentStatus.PENDING,
          },
          data: {
            announcementId: created.id,
            ownerKind: AttachmentOwner.ANNOUNCEMENT,
            status: AttachmentStatus.COMMITTED,
          },
        });
      }

      return created;
    });

    // Notify immediately only if it's live now; scheduled notices are picked up
    // by the sweeper when their publish time arrives.
    if (publishedAt.getTime() <= Date.now()) {
      await this.claimAndNotify(announcement.id, announcement.condoId);
    }

    return this.getOne(user, announcement.id, { manage: true });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      include: {
        blocks: { select: { blockId: true } },
        units: { select: { unitId: true } },
      },
    });
    if (!existing) throw new NotFoundException();
    if (!isManagementForCondo(user, existing.condoId)) {
      throw new ForbiddenException('Only management can update announcements for this condo');
    }

    const nextAudienceScope = dto.audienceScope ?? existing.audienceScope;
    const nextBlockIds = dto.blockIds ?? existing.blocks.map((b) => b.blockId);
    const nextUnitIds = dto.unitIds ?? existing.units.map((u) => u.unitId);

    if (
      dto.audienceScope !== undefined ||
      dto.blockIds !== undefined ||
      dto.unitIds !== undefined
    ) {
      await this.validateAudience(existing.condoId, nextAudienceScope, nextBlockIds, nextUnitIds);
    }

    const nextPublishedAt = dto.publishedAt !== undefined ? dto.publishedAt : existing.publishedAt;
    const nextExpiresAt = dto.expiresAt !== undefined ? dto.expiresAt : existing.expiresAt;
    if (nextPublishedAt) {
      this.validateSchedule(nextPublishedAt, nextExpiresAt ?? null);
    }

    const data: Prisma.AnnouncementUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.importance !== undefined) data.importance = dto.importance;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.audienceScope !== undefined) data.audienceScope = dto.audienceScope;
    if (dto.publishedAt !== undefined) data.publishedAt = dto.publishedAt;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt;
    if (dto.requiresAck !== undefined) data.requiresAck = dto.requiresAck;
    if (dto.pinned !== undefined) data.pinned = dto.pinned;

    const becomingUnpublishedOrScheduled =
      dto.publishedAt !== undefined &&
      (dto.publishedAt === null || dto.publishedAt.getTime() > Date.now());
    if (becomingUnpublishedOrScheduled) {
      data.notifiedAt = null;
    }

    const audienceChanged =
      dto.audienceScope !== undefined || dto.blockIds !== undefined || dto.unitIds !== undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id }, data });

      if (audienceChanged) {
        await tx.announcementBlock.deleteMany({ where: { announcementId: id } });
        await tx.announcementUnit.deleteMany({ where: { announcementId: id } });

        if (nextAudienceScope === AnnouncementAudienceScope.BLOCKS && nextBlockIds.length) {
          await tx.announcementBlock.createMany({
            data: nextBlockIds.map((blockId) => ({ announcementId: id, blockId })),
          });
        }
        if (nextAudienceScope === AnnouncementAudienceScope.UNITS && nextUnitIds.length) {
          await tx.announcementUnit.createMany({
            data: nextUnitIds.map((unitId) => ({ announcementId: id, unitId })),
          });
        }
      }
    });

    const isLiveNow = nextPublishedAt != null && nextPublishedAt.getTime() <= Date.now();
    if (isLiveNow) {
      await this.claimAndNotify(id, existing.condoId);
    }

    return this.getOne(user, id, { manage: true });
  }

  async softDelete(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.announcement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();
    if (!isManagementForCondo(user, existing.condoId)) {
      throw new ForbiddenException('Only management can delete announcements for this condo');
    }
    await this.prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async markRead(user: AuthenticatedUser, announcementId: string) {
    await this.assertResidentCanAccess(user, announcementId);
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId: user.id } },
      update: {},
      create: { announcementId, userId: user.id },
    });
    return { ok: true };
  }

  async acknowledge(user: AuthenticatedUser, announcementId: string) {
    await this.assertResidentCanAccess(user, announcementId);
    await this.prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId, userId: user.id } },
      update: {},
      create: { announcementId, userId: user.id },
    });
    await this.markRead(user, announcementId);
    return { ok: true };
  }

  private async assertResidentCanAccess(user: AuthenticatedUser, announcementId: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, deletedAt: null },
      include: {
        blocks: { select: { blockId: true } },
        units: { select: { unitId: true } },
      },
    });
    if (!announcement) throw new NotFoundException();
    if (isManagementForCondo(user, announcement.condoId)) return;
    const audienceCtx = await this.getResidentAudienceContext(user, announcement.condoId);
    if (!announcementMatchesResident(announcement, audienceCtx)) {
      throw new NotFoundException();
    }
  }

  private async getResidentAudienceContext(user: AuthenticatedUser, condoId: string) {
    const roleUnitIds = user.roles
      .filter((r) => r.condoId === condoId && r.unitId)
      .map((r) => r.unitId as string);
    if (roleUnitIds.length === 0) {
      return { unitIds: [], blockIds: [] };
    }
    const units = await this.prisma.unit.findMany({
      where: { id: { in: roleUnitIds }, condoId },
      select: { id: true, blockId: true },
    });
    return residentAudienceFromRoles(user, condoId, units);
  }

  private async validateAudience(
    condoId: string,
    scope: AnnouncementAudienceScope,
    blockIds?: string[],
    unitIds?: string[],
  ) {
    if (scope === AnnouncementAudienceScope.BLOCKS) {
      if (!blockIds?.length) {
        throw new BadRequestException('Select at least one block for block-targeted notices');
      }
      const count = await this.prisma.block.count({
        where: { condoId, id: { in: blockIds } },
      });
      if (count !== blockIds.length) {
        throw new BadRequestException('One or more blocks are invalid for this condo');
      }
    }
    if (scope === AnnouncementAudienceScope.UNITS) {
      if (!unitIds?.length) {
        throw new BadRequestException('Select at least one unit for unit-targeted notices');
      }
      const count = await this.prisma.unit.count({
        where: { condoId, id: { in: unitIds } },
      });
      if (count !== unitIds.length) {
        throw new BadRequestException('One or more units are invalid for this condo');
      }
    }
  }

  /**
   * Publishes notifications for scheduled notices whose publish time has arrived.
   * Called by the sweeper. The notifiedAt claim is atomic so a notice is never
   * double-dispatched (sweeper vs. immediate publish on edit).
   */
  async publishDueScheduled(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        notifiedAt: null,
        publishedAt: { not: null, lte: now },
      },
      select: { id: true, condoId: true },
    });
    let notified = 0;
    for (const a of due) {
      if (await this.claimAndNotify(a.id, a.condoId, now)) notified += 1;
    }
    return notified;
  }

  /** Atomically claim the notifiedAt slot, then emit the published event once. */
  private async claimAndNotify(id: string, condoId: string, now: Date = new Date()) {
    const claimed = await this.prisma.announcement.updateMany({
      where: { id, notifiedAt: null },
      data: { notifiedAt: now },
    });
    if (claimed.count !== 1) return false;
    this.events.emit('announcement.published', { announcementId: id, condoId });
    return true;
  }

  private validateSchedule(publishedAt: Date, expiresAt: Date | null) {
    if (expiresAt && expiresAt.getTime() <= publishedAt.getTime()) {
      throw new BadRequestException('Expiry must be after the publish time');
    }
  }

  private async validateAttachments(userId: string, attachmentIds: string[]) {
    const attachments = await this.prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        uploadedByUserId: userId,
        ownerKind: AttachmentOwner.GENERIC,
        status: AttachmentStatus.PENDING,
      },
    });
    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException('One or more attachments are invalid or already used');
    }
    const pdfCount = attachments.filter((a) => isPdfMime(a.mimeType)).length;
    if (pdfCount > 1) {
      throw new BadRequestException('Only one PDF memo can be attached per announcement');
    }
  }

  private serialize(
    row: AnnouncementRow,
    _userId: string,
    opts?: {
      manage?: boolean;
      readStats?: { recipientCount: number; readCount: number; readPercent: number };
    },
  ) {
    const meta = (a: Attachment) => {
      const raw = a.metadata;
      const fileName =
        raw && typeof raw === 'object' && !Array.isArray(raw) && 'fileName' in raw
          ? String((raw as { fileName?: unknown }).fileName ?? '')
          : null;
      return fileName || null;
    };

    return {
      id: row.id,
      condoId: row.condoId,
      title: row.title,
      body: row.body,
      importance: row.importance,
      category: row.category,
      audienceScope: row.audienceScope,
      audienceSummary: formatAudienceSummary(row),
      audienceBlocks: row.blocks.map((b) => ({ id: b.block.id, name: b.block.name })),
      audienceUnits: row.units.map((u) => ({ id: u.unit.id, identifier: u.unit.identifier })),
      status: announcementStatus(row),
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      requiresAck: row.requiresAck,
      pinned: row.pinned,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        size: a.size,
        width: a.width,
        height: a.height,
        fileName: meta(a),
      })),
      ackCount: row._count.acks,
      ...(opts?.manage ? { readCount: row._count.reads } : {}),
      ...(opts?.readStats ? { readStats: opts.readStats } : {}),
      readByMe: (row.reads?.length ?? 0) > 0,
      ackedByMe: (row.acks?.length ?? 0) > 0,
    };
  }
}
