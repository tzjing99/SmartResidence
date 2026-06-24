import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AnnouncementAudienceScope,
  AttachmentOwner,
  AttachmentStatus,
  type Announcement,
  type Attachment,
  type Prisma,
  type User,
} from '@prisma/client';
import { announcementStatus, isPdfMime } from '@smartresidence/shared-types';
import {
  announcementMatchesResident,
  audienceWhereForResident,
  formatAudienceSummary,
  isManagementForCondo,
  residentAudienceFromRoles,
} from './announcement-audience';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

type AnnouncementRow = Announcement & {
  author: Pick<User, 'id' | 'name'>;
  attachments: Attachment[];
  blocks: Array<{ blockId: string; block: { id: string; name: string } }>;
  units: Array<{ unitId: string; unit: { id: string; identifier: string } }>;
  _count: { acks: number };
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
  _count: { select: { acks: true } },
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
    opts: { limit: number; offset: number; manage?: boolean },
  ) {
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      condoId,
      deletedAt: null,
    };

    if (opts.manage) {
      where.OR = [{ publishedAt: { not: null } }, { publishedAt: null }];
    } else {
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

    return {
      items: items.map((row) => this.serialize(row as AnnouncementRow, user.id)),
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
      // Residents must never see drafts, future-scheduled, or expired notices.
      if (announcementStatus(row) !== 'PUBLISHED') {
        throw new NotFoundException();
      }
      const audienceCtx = await this.getResidentAudienceContext(user, row.condoId);
      if (!announcementMatchesResident(row, audienceCtx)) {
        throw new NotFoundException();
      }
    }

    return this.serialize(row as AnnouncementRow, user.id);
  }

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto) {
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
    });
    if (!existing) throw new NotFoundException();

    const nextPublishedAt =
      dto.publishedAt !== undefined ? dto.publishedAt : existing.publishedAt;
    const nextExpiresAt = dto.expiresAt !== undefined ? dto.expiresAt : existing.expiresAt;
    if (nextPublishedAt) {
      this.validateSchedule(nextPublishedAt, nextExpiresAt ?? null);
    }

    const data: Prisma.AnnouncementUpdateInput = {};
    if (dto.publishedAt !== undefined) data.publishedAt = dto.publishedAt;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt;
    if (dto.pinned !== undefined) data.pinned = dto.pinned;

    // Reverting to a draft (or re-scheduling for the future) re-arms notification
    // so a later publish notifies residents again.
    const becomingUnpublishedOrScheduled =
      dto.publishedAt !== undefined &&
      (dto.publishedAt === null || dto.publishedAt.getTime() > Date.now());
    if (becomingUnpublishedOrScheduled) {
      data.notifiedAt = null;
    }

    await this.prisma.announcement.update({ where: { id }, data });

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

  private serialize(row: AnnouncementRow, userId: string) {
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
      readByMe: (row.reads?.length ?? 0) > 0,
      ackedByMe: (row.acks?.length ?? 0) > 0,
    };
  }
}
