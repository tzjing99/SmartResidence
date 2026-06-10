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
  AnnouncementAudienceScope,
  AttachmentOwner,
  AttachmentStatus,
  type Prisma,
  RoleId,
} from '@prisma/client';
import type { CreateAnnouncementDto, ListAnnouncementsDto, UpdateAnnouncementDto } from './dto/announcement.dto';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

const listInclude = {
  author: { select: { id: true, name: true } },
  attachments: {
    where: { status: AttachmentStatus.COMMITTED },
    select: { id: true, mimeType: true, size: true, metadata: true },
  },
  audienceBlocks: { select: { blockId: true, block: { select: { id: true, name: true } } } },
  audienceUnits: { select: { unitId: true, unit: { select: { id: true, identifier: true } } } },
  _count: { select: { acks: true, reads: true } },
} satisfies Prisma.AnnouncementInclude;

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

function attachmentFileName(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const name = (metadata as { fileName?: unknown }).fileName;
  return typeof name === 'string' ? name : undefined;
}

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private isManagement(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => MANAGEMENT_ROLES.includes(r.roleId));
  }

  private unitIds(user: AuthenticatedUser): string[] {
    return unique(user.roles.map((r) => r.unitId));
  }

  private managementCondoIds(user: AuthenticatedUser): string[] {
    return unique(
      user.roles.filter((r) => MANAGEMENT_ROLES.includes(r.roleId)).map((r) => r.condoId),
    );
  }

  private assertManagementCondo(user: AuthenticatedUser, condoId: string): void {
    if (!this.managementCondoIds(user).includes(condoId)) {
      throw new ForbiddenException();
    }
  }

  private validateAudience(
    scope: AnnouncementAudienceScope,
    blockIds?: string[],
    unitIds?: string[],
  ): void {
    if (scope === AnnouncementAudienceScope.BLOCKS && (!blockIds || blockIds.length === 0)) {
      throw new BadRequestException('Select at least one block when targeting by block');
    }
    if (scope === AnnouncementAudienceScope.UNITS && (!unitIds || unitIds.length === 0)) {
      throw new BadRequestException('Select at least one unit when targeting by unit');
    }
  }

  private notDeleted(): Prisma.AnnouncementWhereInput {
    return { deletedAt: null };
  }

  private notExpired(now = new Date()): Prisma.AnnouncementWhereInput {
    return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  }

  private publishedOnly(now = new Date()): Prisma.AnnouncementWhereInput {
    return { publishedAt: { not: null, lte: now } };
  }

  private async residentContext(user: AuthenticatedUser, condoId: string) {
    const unitIds = this.unitIds(user);
    if (unitIds.length === 0) return { unitIds: [] as string[], blockIds: [] as string[] };
    const units = await this.prisma.unit.findMany({
      where: { id: { in: unitIds }, condoId },
      select: { id: true, blockId: true },
    });
    return {
      unitIds: units.map((u) => u.id),
      blockIds: unique(units.map((u) => u.blockId)),
    };
  }

  private audienceWhere(
    ctx: { unitIds: string[]; blockIds: string[] },
  ): Prisma.AnnouncementWhereInput {
    const parts: Prisma.AnnouncementWhereInput[] = [{ audienceScope: AnnouncementAudienceScope.CONDO }];
    if (ctx.blockIds.length > 0) {
      parts.push({
        audienceScope: AnnouncementAudienceScope.BLOCKS,
        audienceBlocks: { some: { blockId: { in: ctx.blockIds } } },
      });
    }
    if (ctx.unitIds.length > 0) {
      parts.push({
        audienceScope: AnnouncementAudienceScope.UNITS,
        audienceUnits: { some: { unitId: { in: ctx.unitIds } } },
      });
    }
    return { OR: parts };
  }

  private mapAttachment(a: { id: string; mimeType: string; size: number; metadata: unknown }) {
    return {
      id: a.id,
      mimeType: a.mimeType,
      size: a.size,
      fileName: attachmentFileName(a.metadata),
    };
  }

  private mapSummary(
    a: Prisma.AnnouncementGetPayload<{ include: typeof listInclude }> & {
      reads?: { readAt: Date }[];
    },
    opts: { includeBody?: boolean } = {},
  ) {
    return {
      id: a.id,
      condoId: a.condoId,
      title: a.title,
      ...(opts.includeBody ? { body: a.body } : {}),
      category: a.category,
      importance: a.importance,
      audienceScope: a.audienceScope,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
      requiresAck: a.requiresAck,
      pinned: a.pinned,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      author: a.author,
      readAt: a.reads?.[0]?.readAt ?? null,
      attachments: a.attachments.map((att) => this.mapAttachment(att)),
      attachmentCount: a.attachments.length,
      audienceBlocks: a.audienceBlocks.map((row) => row.block),
      audienceUnits: a.audienceUnits.map((row) => row.unit),
      _count: a._count,
    };
  }

  async list(user: AuthenticatedUser, condoId: string, opts: ListAnnouncementsDto) {
    const ctx = await this.residentContext(user, condoId);
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      condoId,
      ...this.notDeleted(),
      ...this.publishedOnly(now),
      ...this.notExpired(now),
      ...this.audienceWhere(ctx),
      ...(opts.category ? { category: opts.category } : {}),
    };

    const readInclude = { reads: { where: { userId: user.id }, select: { readAt: true } } };
    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: { ...listInclude, ...readInclude },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.count({
        where: { ...where, reads: { none: { userId: user.id } } },
      }),
    ]);

    return {
      items: rows.map((row) => this.mapSummary(row)),
      total,
      unreadCount,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async manage(user: AuthenticatedUser, condoId: string, opts: ListAnnouncementsDto) {
    this.assertManagementCondo(user, condoId);
    const where: Prisma.AnnouncementWhereInput = {
      condoId,
      ...this.notDeleted(),
      ...(opts.category ? { category: opts.category } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: listInclude,
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.mapSummary(row, { includeBody: true })),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  private async loadForResident(user: AuthenticatedUser, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, ...this.notDeleted() },
      include: {
        audienceBlocks: { select: { blockId: true } },
        audienceUnits: { select: { unitId: true } },
      },
    });
    if (!announcement) throw new NotFoundException();
    if (this.isManagement(user)) {
      this.assertManagementCondo(user, announcement.condoId);
      return announcement;
    }

    const now = new Date();
    if (!announcement.publishedAt || announcement.publishedAt > now) {
      throw new NotFoundException();
    }
    if (announcement.expiresAt && announcement.expiresAt <= now) {
      throw new NotFoundException();
    }

    const ctx = await this.residentContext(user, announcement.condoId);
    const allowed =
      announcement.audienceScope === AnnouncementAudienceScope.CONDO ||
      (announcement.audienceScope === AnnouncementAudienceScope.BLOCKS &&
        announcement.audienceBlocks.some((b) => ctx.blockIds.includes(b.blockId))) ||
      (announcement.audienceScope === AnnouncementAudienceScope.UNITS &&
        announcement.audienceUnits.some((u) => ctx.unitIds.includes(u.unitId)));
    if (!allowed) throw new ForbiddenException();
    return announcement;
  }

  async getOne(user: AuthenticatedUser, id: string) {
    await this.loadForResident(user, id);
    const readInclude = { reads: { where: { userId: user.id }, select: { readAt: true } } };
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      include: { ...listInclude, ...readInclude },
    });
    if (!row || row.deletedAt) throw new NotFoundException();

    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      update: { readAt: new Date() },
      create: { announcementId: id, userId: user.id },
    });

    const readAt = new Date();
    return this.mapSummary({ ...row, reads: [{ readAt }] }, { includeBody: true });
  }

  async markRead(user: AuthenticatedUser, id: string) {
    await this.loadForResident(user, id);
    return this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      update: { readAt: new Date() },
      create: { announcementId: id, userId: user.id },
    });
  }

  private async syncAudienceRows(
    tx: Prisma.TransactionClient,
    announcementId: string,
    scope: AnnouncementAudienceScope,
    blockIds?: string[],
    unitIds?: string[],
  ) {
    await tx.announcementBlock.deleteMany({ where: { announcementId } });
    await tx.announcementUnit.deleteMany({ where: { announcementId } });
    if (scope === AnnouncementAudienceScope.BLOCKS && blockIds?.length) {
      await tx.announcementBlock.createMany({
        data: blockIds.map((blockId) => ({ announcementId, blockId })),
      });
    }
    if (scope === AnnouncementAudienceScope.UNITS && unitIds?.length) {
      await tx.announcementUnit.createMany({
        data: unitIds.map((unitId) => ({ announcementId, unitId })),
      });
    }
  }

  private async commitAttachments(
    tx: Prisma.TransactionClient,
    userId: string,
    announcementId: string,
    attachmentIds?: string[],
  ) {
    if (!attachmentIds?.length) return;
    await tx.attachment.updateMany({
      where: {
        id: { in: attachmentIds },
        uploadedByUserId: userId,
        ownerKind: AttachmentOwner.GENERIC,
        status: AttachmentStatus.PENDING,
      },
      data: {
        announcementId,
        ownerKind: AttachmentOwner.ANNOUNCEMENT,
        status: AttachmentStatus.COMMITTED,
      },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto) {
    this.assertManagementCondo(user, dto.condoId);
    const scope = dto.audienceScope ?? AnnouncementAudienceScope.CONDO;
    this.validateAudience(scope, dto.blockIds, dto.unitIds);

    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          condoId: dto.condoId,
          authorUserId: user.id,
          title: dto.title,
          body: dto.body,
          category: dto.category ?? 'NOTICE',
          importance: dto.importance ?? 'INFO',
          audienceScope: scope,
          publishedAt: dto.publishedAt ?? null,
          expiresAt: dto.expiresAt ?? null,
          requiresAck: dto.requiresAck ?? false,
          pinned: dto.pinned ?? false,
        },
      });
      await this.syncAudienceRows(tx, created.id, scope, dto.blockIds, dto.unitIds);
      await this.commitAttachments(tx, user.id, created.id, dto.attachmentIds);
      return created;
    });

    if (
      announcement.publishedAt &&
      announcement.publishedAt <= new Date()
    ) {
      this.events.emit('announcement.published', {
        announcementId: announcement.id,
        condoId: announcement.condoId,
      });
    }
    return this.getManageOne(user, announcement.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findFirst({
      where: { id, ...this.notDeleted() },
    });
    if (!existing) throw new NotFoundException();
    this.assertManagementCondo(user, existing.condoId);

    const wasPublished = existing.publishedAt != null;
    if (
      wasPublished &&
      (dto.audienceScope !== undefined ||
        dto.blockIds !== undefined ||
        dto.unitIds !== undefined)
    ) {
      throw new BadRequestException('Audience cannot be changed after publish');
    }

    const scope = dto.audienceScope ?? existing.audienceScope;
    if (!wasPublished) {
      this.validateAudience(
        scope,
        dto.blockIds ?? undefined,
        dto.unitIds ?? undefined,
      );
    }

    const nextPublishedAt =
      dto.publishedAt !== undefined ? dto.publishedAt : existing.publishedAt;
    const becomingPublished =
      !wasPublished && nextPublishedAt != null && nextPublishedAt <= new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.announcement.update({
        where: { id },
        data: {
          title: dto.title,
          body: dto.body,
          category: dto.category,
          importance: dto.importance,
          audienceScope: wasPublished ? undefined : dto.audienceScope,
          publishedAt: dto.publishedAt !== undefined ? dto.publishedAt : undefined,
          expiresAt: dto.expiresAt !== undefined ? dto.expiresAt : undefined,
          requiresAck: dto.requiresAck,
          pinned: dto.pinned,
        },
      });
      if (!wasPublished && (dto.audienceScope !== undefined || dto.blockIds || dto.unitIds)) {
        await this.syncAudienceRows(tx, id, scope, dto.blockIds, dto.unitIds);
      }
      await this.commitAttachments(tx, user.id, id, dto.attachmentIds);
    });

    if (becomingPublished || (wasPublished && dto.republish)) {
      this.events.emit('announcement.published', {
        announcementId: id,
        condoId: existing.condoId,
      });
    }
    return this.getManageOne(user, id);
  }

  async softDelete(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.announcement.findFirst({
      where: { id, ...this.notDeleted() },
    });
    if (!existing) throw new NotFoundException();
    this.assertManagementCondo(user, existing.condoId);
    await this.prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  private async getManageOne(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.announcement.findFirst({
      where: { id, ...this.notDeleted() },
      include: listInclude,
    });
    if (!row) throw new NotFoundException();
    this.assertManagementCondo(user, row.condoId);
    return this.mapSummary(row, { includeBody: true });
  }

  async acknowledge(user: AuthenticatedUser, announcementId: string) {
    await this.loadForResident(user, announcementId);
    return this.prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId, userId: user.id } },
      update: {},
      create: { announcementId, userId: user.id },
    });
  }

  /** Used by attachment authorization to decide if a user can stream a PDF. */
  async canViewAnnouncement(user: AuthenticatedUser, announcementId: string): Promise<boolean> {
    try {
      await this.loadForResident(user, announcementId);
      return true;
    } catch {
      return false;
    }
  }

  /** Resolve resident user IDs for notification fan-out. */
  async residentRecipients(announcementId: string): Promise<string[]> {
    const a = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        audienceBlocks: { select: { blockId: true } },
        audienceUnits: { select: { unitId: true } },
      },
    });
    if (!a || a.deletedAt) return [];

    let unitIds: string[] = [];
    if (a.audienceScope === AnnouncementAudienceScope.CONDO) {
      const units = await this.prisma.unit.findMany({
        where: { condoId: a.condoId },
        select: { id: true },
      });
      unitIds = units.map((u) => u.id);
    } else if (a.audienceScope === AnnouncementAudienceScope.BLOCKS) {
      const blockIds = a.audienceBlocks.map((b) => b.blockId);
      if (blockIds.length === 0) return [];
      const units = await this.prisma.unit.findMany({
        where: { blockId: { in: blockIds } },
        select: { id: true },
      });
      unitIds = units.map((u) => u.id);
    } else {
      unitIds = a.audienceUnits.map((u) => u.unitId);
    }
    if (unitIds.length === 0) return [];

    const [owners, tenants, household] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { unitId: { in: unitIds }, status: 'ACTIVE' },
        select: { userId: true },
      }),
      this.prisma.tenancy.findMany({
        where: { unitId: { in: unitIds }, status: 'ACTIVE' },
        select: { userId: true },
      }),
      this.prisma.householdMember.findMany({
        where: { unitId: { in: unitIds } },
        select: { userId: true },
      }),
    ]);
    return unique([...owners, ...tenants, ...household].map((r) => r.userId));
  }
}
