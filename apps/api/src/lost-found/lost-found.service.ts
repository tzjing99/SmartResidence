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
  AttachmentOwner,
  AttachmentStatus,
  AuditAction,
  type LostFoundPost,
  LostFoundStatus,
  type Prisma,
  RoleId,
} from '@prisma/client';
import type { CreateLostFoundPostDto, ListLostFoundPostsDto } from './dto/lost-found.dto';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

const RESIDENT_ROLES: RoleId[] = [RoleId.UNIT_OWNER, RoleId.TENANT, RoleId.HOUSEHOLD_MEMBER];

const postInclude = {
  user: { select: { id: true, name: true } },
  unit: { select: { id: true, identifier: true, block: { select: { name: true } } } },
  photoAttachment: {
    select: { id: true, key: true, mimeType: true, thumbnailKey: true },
  },
} satisfies Prisma.LostFoundPostInclude;

@Injectable()
export class LostFoundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateLostFoundPostDto): Promise<LostFoundPost> {
    this.assertResidentForCondo(user, dto.condoId);
    if (!this.userCanAccessUnit(user, dto.unitId, dto.condoId)) {
      throw new ForbiddenException('You cannot post for this unit');
    }

    if (dto.photoAttachmentId) {
      await this.assertPhotoAttachment(user.id, dto.photoAttachmentId);
    }

    const post = await this.prisma.lostFoundPost.create({
      data: {
        condoId: dto.condoId,
        userId: user.id,
        unitId: dto.unitId,
        kind: dto.kind,
        title: dto.title.trim(),
        description: dto.description.trim(),
        locationNote: dto.locationNote?.trim() || null,
        contactMethod: dto.contactMethod.trim(),
        photoAttachmentId: dto.photoAttachmentId ?? null,
        status: LostFoundStatus.OPEN,
      },
      include: postInclude,
    });

    if (dto.photoAttachmentId) {
      await this.prisma.attachment.updateMany({
        where: {
          id: dto.photoAttachmentId,
          uploadedByUserId: user.id,
          ownerKind: AttachmentOwner.GENERIC,
        },
        data: { status: AttachmentStatus.COMMITTED },
      });
    }

    await this.audit(user, post.condoId, post.unitId, AuditAction.CREATE, post.id);

    this.events.emit('lostfound.created', {
      postId: post.id,
      condoId: post.condoId,
      userId: post.userId,
    });

    return post;
  }

  async listForCondo(user: AuthenticatedUser, condoId: string, query: ListLostFoundPostsDto) {
    this.assertCondoAccess(user, condoId);
    const manage = query.manage === true && this.isManagement(user, condoId);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const where: Prisma.LostFoundPostWhereInput = { condoId };

    if (manage) {
      if (query.status) where.status = query.status;
      if (query.kind) where.kind = query.kind;
    } else {
      where.status = query.status ?? LostFoundStatus.OPEN;
      if (query.openOnly !== false) {
        where.status = LostFoundStatus.OPEN;
      }
      if (query.kind) where.kind = query.kind;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lostFoundPost.findMany({
        where,
        include: postInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.lostFoundPost.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async listMine(user: AuthenticatedUser, query: ListLostFoundPostsDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const condoIds = this.accessibleCondoIds(user);
    if (condoIds.length === 0) {
      return { items: [], total: 0, limit, offset };
    }

    const where: Prisma.LostFoundPostWhereInput = {
      userId: user.id,
      condoId: { in: condoIds },
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lostFoundPost.findMany({
        where,
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.lostFoundPost.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const post = await this.prisma.lostFoundPost.findUnique({
      where: { id },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!this.canReadPost(user, post)) {
      throw new ForbiddenException('No access to this post');
    }
    return post;
  }

  async resolve(user: AuthenticatedUser, id: string) {
    const post = await this.requirePost(id);
    if (post.status !== LostFoundStatus.OPEN) {
      throw new BadRequestException('Only open posts can be marked resolved');
    }
    if (!this.canResolvePost(user, post)) {
      throw new ForbiddenException('You cannot resolve this post');
    }

    const updated = await this.prisma.lostFoundPost.update({
      where: { id },
      data: { status: LostFoundStatus.RESOLVED, resolvedAt: new Date() },
      include: postInclude,
    });

    await this.audit(user, post.condoId, post.unitId, AuditAction.UPDATE, id, { resolved: true });
    this.events.emit('lostfound.resolved', {
      postId: id,
      condoId: post.condoId,
      userId: post.userId,
    });
    return updated;
  }

  async removeOwn(user: AuthenticatedUser, id: string) {
    const post = await this.requirePost(id);
    if (post.userId !== user.id) {
      throw new ForbiddenException('You can only remove your own posts');
    }
    if (post.status === LostFoundStatus.REMOVED) {
      throw new BadRequestException('Post already removed');
    }

    const updated = await this.prisma.lostFoundPost.update({
      where: { id },
      data: { status: LostFoundStatus.REMOVED },
      include: postInclude,
    });

    await this.audit(user, post.condoId, post.unitId, AuditAction.DELETE, id, {
      removedByOwner: true,
    });
    return updated;
  }

  async moderateRemove(user: AuthenticatedUser, id: string) {
    const post = await this.requirePost(id);
    this.assertManagement(user, post.condoId);
    if (post.status === LostFoundStatus.REMOVED) {
      throw new BadRequestException('Post already removed');
    }

    const updated = await this.prisma.lostFoundPost.update({
      where: { id },
      data: { status: LostFoundStatus.REMOVED },
      include: postInclude,
    });

    await this.audit(user, post.condoId, post.unitId, AuditAction.DELETE, id, {
      moderated: true,
    });
    return updated;
  }

  private async requirePost(id: string) {
    const post = await this.prisma.lostFoundPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async assertPhotoAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        uploadedByUserId: true,
        ownerKind: true,
        lostFoundPost: { select: { id: true } },
      },
    });
    if (!attachment) throw new BadRequestException('Photo attachment not found');
    if (attachment.uploadedByUserId !== userId) {
      throw new BadRequestException('Photo attachment was not uploaded by you');
    }
    if (attachment.ownerKind !== AttachmentOwner.GENERIC) {
      throw new BadRequestException('Photo attachment is already in use');
    }
    if (attachment.lostFoundPost) {
      throw new BadRequestException('Photo attachment is already linked to a post');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }

  private assertResidentForCondo(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some(
      (r) =>
        RESIDENT_ROLES.includes(r.roleId) &&
        (r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN),
    );
    if (!ok) throw new ForbiddenException('Only residents can post to the lost & found board');
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Management access required');
    }
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        MANAGEMENT_ROLES.includes(r.roleId) &&
        (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
    );
  }

  private accessibleCondoIds(user: AuthenticatedUser): string[] {
    return [...new Set(user.roles.map((r) => r.condoId).filter((id): id is string => Boolean(id)))];
  }

  private userCanAccessUnit(user: AuthenticatedUser, unitId: string, condoId: string): boolean {
    return user.roles.some(
      (r) => r.unitId === unitId && r.condoId === condoId && RESIDENT_ROLES.includes(r.roleId),
    );
  }

  private canReadPost(
    user: AuthenticatedUser,
    post: { condoId: string; userId: string; status: LostFoundStatus },
  ): boolean {
    if (this.isManagement(user, post.condoId)) return true;
    if (!this.assertCondoAccessSilent(user, post.condoId)) return false;
    if (post.status === LostFoundStatus.REMOVED && post.userId !== user.id) return false;
    return true;
  }

  private canResolvePost(
    user: AuthenticatedUser,
    post: { condoId: string; userId: string },
  ): boolean {
    if (post.userId === user.id) return true;
    return this.isManagement(user, post.condoId);
  }

  private assertCondoAccessSilent(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some((r) => r.condoId === condoId || r.roleId === RoleId.SUPER_ADMIN);
  }

  private async audit(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string | null,
    action: AuditAction,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action,
        resourceType: 'LostFoundPost',
        resourceId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
