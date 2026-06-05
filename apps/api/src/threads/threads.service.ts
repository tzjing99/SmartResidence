import type { AuthenticatedUser } from '@/common/types/request-context';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttachmentOwner,
  AuditAction,
  NotificationKind,
  type Prisma,
  RoleId,
  ThreadMessageKind,
  ThreadStatus,
} from '@prisma/client';
import { AI_ASSIST_PROVIDER, type AiAssistProvider } from './ai/ai-assist.provider';
import type {
  CreateThreadDto,
  ListThreadsDto,
  PostMessageDto,
  UpdateThreadDto,
} from './dto/thread.dto';
import { SlaService } from './sla/sla.service';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

function unique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly sla: SlaService,
    private readonly notifications: NotificationService,
    @Inject(AI_ASSIST_PROVIDER) private readonly ai: AiAssistProvider,
  ) {}

  // -- role helpers --------------------------------------------------

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

  private async managementUserIds(condoId: string): Promise<string[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        condoId,
        roleId: { in: [RoleId.MANAGEMENT_ADMIN, RoleId.MANAGEMENT_STAFF] },
        revokedAt: null,
      },
      select: { userId: true },
    });
    return unique(rows.map((r) => r.userId));
  }

  // -- create --------------------------------------------------------

  async create(user: AuthenticatedUser, dto: CreateThreadDto) {
    let unitId = dto.unitId ?? null;
    let condoId: string | null = null;

    if (unitId) {
      const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) throw new NotFoundException('Unit not found');
      condoId = unit.condoId;
      if (!this.isManagement(user) && !this.unitIds(user).includes(unitId)) {
        throw new ForbiddenException('You cannot open a thread for this unit');
      }
    } else {
      const residentRole = user.roles.find((r) => r.unitId);
      unitId = residentRole?.unitId ?? null;
      condoId = residentRole?.condoId ?? user.roles.find((r) => r.condoId)?.condoId ?? null;
    }
    if (!condoId) throw new BadRequestException('No condo context for this thread');

    const priority = await this.ai.suggestPriority({
      subject: dto.subject,
      body: dto.body,
      category: dto.category,
    });
    const due = await this.sla.computeDueDates(condoId, priority);

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.thread.create({
        data: {
          condoId,
          unitId,
          createdByUserId: user.id,
          subject: dto.subject,
          category: dto.category,
          priority,
          status: ThreadStatus.OPEN,
          slaPolicyId: due.slaPolicyId,
          firstResponseDueAt: due.firstResponseDueAt,
          resolutionDueAt: due.resolutionDueAt,
          lastMessageAt: new Date(),
          participants: { create: { userId: user.id, lastReadAt: new Date() } },
        },
      });
      const message = await tx.threadMessage.create({
        data: {
          threadId: created.id,
          authorUserId: user.id,
          kind: ThreadMessageKind.MESSAGE,
          body: dto.body,
        },
      });
      if (dto.attachmentIds?.length) {
        await tx.attachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            uploadedByUserId: user.id,
            ownerKind: AttachmentOwner.GENERIC,
          },
          data: { threadMessageId: message.id, ownerKind: AttachmentOwner.THREAD_MESSAGE },
        });
      }
      return created;
    });

    this.events.emit('thread.created', { threadId: thread.id, condoId: thread.condoId });
    await this.notifications.dispatch({
      userIds: await this.managementUserIds(condoId),
      kind: NotificationKind.THREAD_MESSAGE,
      title: `New ${dto.category.toLowerCase()} thread`,
      body: dto.subject,
      data: { threadId: thread.id },
    });
    return thread;
  }

  // -- list ----------------------------------------------------------

  async list(user: AuthenticatedUser, dto: ListThreadsDto) {
    const where: Prisma.ThreadWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.assignedToUserId ? { assignedToUserId: dto.assignedToUserId } : {}),
    };

    if (this.isManagement(user)) {
      where.condoId = { in: this.managementCondoIds(user) };
    } else {
      // Residents see threads they created or that belong to their unit(s).
      where.OR = [{ createdByUserId: user.id }, { unitId: { in: this.unitIds(user) } }];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.thread.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
          unit: { select: { id: true, identifier: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [{ lastMessageAt: 'desc' }],
        take: dto.limit,
        skip: dto.offset,
      }),
      this.prisma.thread.count({ where }),
    ]);

    const withSla = items.map((t) => ({ ...t, slaState: this.sla.computeSlaState(t) }));
    const filtered = dto.slaState ? withSla.filter((t) => t.slaState === dto.slaState) : withSla;
    return { items: filtered, total, limit: dto.limit, offset: dto.offset };
  }

  // -- read one ------------------------------------------------------

  private async loadAndAuthorize(user: AuthenticatedUser, id: string) {
    const thread = await this.prisma.thread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException();
    const allowed = this.isManagement(user)
      ? this.managementCondoIds(user).includes(thread.condoId)
      : thread.createdByUserId === user.id ||
        (thread.unitId !== null && this.unitIds(user).includes(thread.unitId));
    if (!allowed) throw new ForbiddenException();
    return thread;
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const thread = await this.loadAndAuthorize(user, id);
    const isMgmt = this.isManagement(user);

    const full = await this.prisma.thread.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        unit: { select: { id: true, identifier: true } },
        messages: {
          // Residents never see INTERNAL_NOTE messages.
          where: isMgmt ? {} : { kind: { not: ThreadMessageKind.INTERNAL_NOTE } },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true } },
            attachments: true,
          },
        },
      },
    });

    // Mark read for this user.
    await this.prisma.threadParticipant.upsert({
      where: { threadId_userId: { threadId: id, userId: user.id } },
      update: { lastReadAt: new Date() },
      create: { threadId: id, userId: user.id, lastReadAt: new Date() },
    });

    return { ...full, slaState: this.sla.computeSlaState(thread) };
  }

  // -- post message --------------------------------------------------

  async postMessage(user: AuthenticatedUser, id: string, dto: PostMessageDto) {
    const thread = await this.loadAndAuthorize(user, id);
    const isMgmt = this.isManagement(user);
    if (dto.internalNote && !isMgmt) {
      throw new ForbiddenException('Only management can add internal notes');
    }
    if (thread.status === ThreadStatus.CLOSED && !isMgmt) {
      throw new BadRequestException('This thread is closed');
    }

    const now = new Date();
    const kind = dto.internalNote ? ThreadMessageKind.INTERNAL_NOTE : ThreadMessageKind.MESSAGE;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.threadMessage.create({
        data: { threadId: id, authorUserId: user.id, kind, body: dto.body },
      });
      if (dto.attachmentIds?.length) {
        await tx.attachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            uploadedByUserId: user.id,
            ownerKind: AttachmentOwner.GENERIC,
          },
          data: { threadMessageId: created.id, ownerKind: AttachmentOwner.THREAD_MESSAGE },
        });
      }

      // Internal notes do not move the conversation state.
      if (kind !== ThreadMessageKind.INTERNAL_NOTE) {
        const data: Prisma.ThreadUpdateInput = { lastMessageAt: now };
        if (isMgmt) {
          data.status = ThreadStatus.AWAITING_RESIDENT;
          if (!thread.firstRespondedAt) data.firstRespondedAt = now;
        } else {
          data.status =
            thread.status === ThreadStatus.RESOLVED || thread.status === ThreadStatus.CLOSED
              ? ThreadStatus.REOPENED
              : ThreadStatus.AWAITING_MANAGEMENT;
        }
        await tx.thread.update({ where: { id }, data });
      } else {
        await tx.thread.update({ where: { id }, data: { lastMessageAt: now } });
      }
      return created;
    });

    this.events.emit('thread.message', {
      threadId: id,
      condoId: thread.condoId,
      messageId: message.id,
      internal: kind === ThreadMessageKind.INTERNAL_NOTE,
    });

    // Notify the other side (skip for internal notes).
    if (kind !== ThreadMessageKind.INTERNAL_NOTE) {
      const recipients = isMgmt
        ? [thread.createdByUserId]
        : thread.assignedToUserId
          ? [thread.assignedToUserId]
          : await this.managementUserIds(thread.condoId);
      await this.notifications.dispatch({
        userIds: recipients.filter((uid) => uid !== user.id),
        kind: NotificationKind.THREAD_MESSAGE,
        title: `Reply: ${thread.subject}`,
        body: dto.body.slice(0, 140),
        data: { threadId: id },
      });
    }

    return message;
  }

  // -- management update ---------------------------------------------

  async update(user: AuthenticatedUser, id: string, dto: UpdateThreadDto) {
    const thread = await this.loadAndAuthorize(user, id);
    const now = new Date();
    const data: Prisma.ThreadUpdateInput = {};
    const systemLines: string[] = [];

    if (dto.priority && dto.priority !== thread.priority) {
      data.priority = dto.priority;
      const due = await this.sla.computeDueDates(thread.condoId, dto.priority, thread.createdAt);
      data.firstResponseDueAt = due.firstResponseDueAt;
      data.resolutionDueAt = due.resolutionDueAt;
      if (due.slaPolicyId) data.slaPolicy = { connect: { id: due.slaPolicyId } };
      systemLines.push(`Priority changed to ${dto.priority}`);
    }

    if (dto.assignedToUserId && dto.assignedToUserId !== thread.assignedToUserId) {
      data.assignedTo = { connect: { id: dto.assignedToUserId } };
      systemLines.push('Thread reassigned');
    }

    if (dto.status && dto.status !== thread.status) {
      data.status = dto.status;
      if (dto.status === ThreadStatus.RESOLVED) data.resolvedAt = now;
      if (dto.status === ThreadStatus.CLOSED) data.closedAt = now;
      if (dto.status === ThreadStatus.REOPENED) {
        data.resolvedAt = null;
        data.closedAt = null;
      }
      systemLines.push(`Status changed to ${dto.status}`);
    }

    if (systemLines.length === 0) return thread;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.thread.update({ where: { id }, data: { ...data, lastMessageAt: now } });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.SYSTEM,
          body: systemLines.join('; '),
        },
      });
      return u;
    });

    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });

    if (dto.assignedToUserId && dto.assignedToUserId !== thread.assignedToUserId) {
      await this.notifications.dispatch({
        userIds: [dto.assignedToUserId],
        kind: NotificationKind.THREAD_ASSIGNED,
        title: 'Thread assigned to you',
        body: thread.subject,
        data: { threadId: id },
      });
    }
    if (dto.status && dto.status !== thread.status) {
      await this.notifications.dispatch({
        userIds: [thread.createdByUserId].filter((uid) => uid !== user.id),
        kind: NotificationKind.THREAD_STATUS,
        title: `Thread ${dto.status.toLowerCase()}`,
        body: thread.subject,
        data: { threadId: id },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        condoId: thread.condoId,
        unitId: thread.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'Thread',
        resourceId: id,
        metadata: { changes: systemLines } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  // -- read receipt --------------------------------------------------

  async markRead(user: AuthenticatedUser, id: string) {
    await this.loadAndAuthorize(user, id);
    return this.prisma.threadParticipant.upsert({
      where: { threadId_userId: { threadId: id, userId: user.id } },
      update: { lastReadAt: new Date() },
      create: { threadId: id, userId: user.id, lastReadAt: new Date() },
    });
  }
}
