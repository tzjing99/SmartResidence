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
  AttachmentStatus,
  AuditAction,
  NotificationKind,
  type Prisma,
  RoleId,
  ThreadMessageKind,
  ThreadStatus,
} from '@prisma/client';
import { AI_ASSIST_PROVIDER, type AiAssistProvider } from './ai/ai-assist.provider';
import type {
  AppealThreadDto,
  CloseAbusiveThreadDto,
  ConfirmResolutionDto,
  CreateThreadDto,
  ListThreadsDto,
  PostMessageDto,
  ProposeResolutionDto,
  RequestResidentDto,
  UpdateThreadDto,
} from './dto/thread.dto';
import { SlaService } from './sla/sla.service';
import { ThreadAssignmentService } from './thread-assignment.service';
import { buildThreadPdf } from './thread-export';

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
    private readonly assignment: ThreadAssignmentService,
    @Inject(AI_ASSIST_PROVIDER) private readonly ai: AiAssistProvider,
  ) {}

  // -- role helpers --------------------------------------------------

  private isManagement(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => MANAGEMENT_ROLES.includes(r.roleId));
  }

  private unitIds(user: AuthenticatedUser): string[] {
    return unique(user.roles.map((r) => r.unitId));
  }

  /** D2: any household member linked to the unit may confirm resolution. */
  private canActAsResident(user: AuthenticatedUser, thread: { unitId: string | null }): boolean {
    if (this.isManagement(user)) return false;
    if (thread.unitId && this.unitIds(user).includes(thread.unitId)) return true;
    return false;
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
    const resolvedCondoId = condoId;

    // Auto-assignment is independent of the AI priority + SLA due-date chain, so
    // run them concurrently to shave a round-trip off thread creation.
    const [{ suggestion, due }, assign] = await Promise.all([
      (async () => {
        const suggestion = await this.ai.suggestPriority({
          subject: dto.subject,
          body: dto.body,
          category: dto.category,
          condoId: resolvedCondoId,
        });
        const due = await this.sla.computeDueDates(resolvedCondoId, suggestion.priority);
        return { suggestion, due };
      })(),
      this.assignment.assignOnCreate({
        condoId: resolvedCondoId,
        unitId,
        createdByUserId: user.id,
        category: dto.category,
        subject: dto.subject,
      }),
    ]);

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.thread.create({
        data: {
          condoId,
          unitId,
          createdByUserId: user.id,
          assignedToUserId: assign.assignedToUserId,
          subject: dto.subject,
          category: dto.category,
          priority: suggestion.priority,
          status: ThreadStatus.OPEN,
          slaPolicyId: due.slaPolicyId,
          firstResponseDueAt: due.firstResponseDueAt,
          resolutionDueAt: due.resolutionDueAt,
          lastMessageAt: new Date(),
          metadata: {
            repeatComplainant: assign.repeatComplainant,
            duplicateSuggestions: assign.duplicateSuggestions,
            prioritySource: suggestion.source,
          } as Prisma.InputJsonValue,
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
          data: {
            threadMessageId: message.id,
            ownerKind: AttachmentOwner.THREAD_MESSAGE,
            status: AttachmentStatus.COMMITTED,
          },
        });
      }
      return created;
    });

    this.events.emit('thread.created', { threadId: thread.id, condoId: thread.condoId });
    const notifyIds = assign.assignedToUserId
      ? [assign.assignedToUserId]
      : await this.managementUserIds(condoId);
    await this.notifications.dispatch({
      userIds: notifyIds,
      kind: assign.assignedToUserId
        ? NotificationKind.THREAD_ASSIGNED
        : NotificationKind.THREAD_MESSAGE,
      title: assign.assignedToUserId
        ? 'Thread assigned to you'
        : `New ${dto.category.toLowerCase()} thread`,
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
          data: {
            threadMessageId: created.id,
            ownerKind: AttachmentOwner.THREAD_MESSAGE,
            status: AttachmentStatus.COMMITTED,
          },
        });
      }

      // Internal notes do not move the conversation state.
      if (kind !== ThreadMessageKind.INTERNAL_NOTE) {
        const data: Prisma.ThreadUpdateInput = { lastMessageAt: now };
        if (isMgmt) {
          // A plain management reply does NOT flip the ball to the resident —
          // management is still working the ticket (use the explicit
          // "request to resident" action to set AWAITING_RESIDENT). Posting a
          // message counts as a first response and re-engages the thread,
          // clearing any outstanding resolution proposal.
          if (thread.status !== ThreadStatus.RESOLVED && thread.status !== ThreadStatus.CLOSED) {
            data.status = ThreadStatus.AWAITING_MANAGEMENT;
            data.resolutionProposedAt = null;
            data.resolutionProposedByUserId = null;
            data.resolutionProposedMessage = { disconnect: true };
            if (!thread.firstRespondedAt) data.firstRespondedAt = now;
          }
        } else if (
          thread.status === ThreadStatus.RESOLVED ||
          thread.status === ThreadStatus.CLOSED
        ) {
          // B15: auto-reopen on resident message (no SLA reset — B12).
          data.status = ThreadStatus.REOPENED;
          data.resolvedAt = null;
          data.closedAt = null;
          data.reopenCount = { increment: 1 };
        } else if (thread.status === ThreadStatus.AWAITING_MANAGEMENT) {
          // Rule 1: a resident adding more detail while AWAITING_MANAGEMENT must
          // NOT flip the ball back to themselves — keep the status unchanged.
        } else if (thread.status === ThreadStatus.PENDING_RESIDENT_CONFIRMATION) {
          // Residents must use the structured reject flow (B3).
          throw new BadRequestException(
            'Use the reject resolution form instead of replying while confirmation is pending',
          );
        } else {
          // OPEN / AWAITING_RESIDENT / REOPENED → the ball is now with management.
          data.status = ThreadStatus.AWAITING_MANAGEMENT;
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

    // Resolution is resident-driven (D2): management cannot unilaterally mark a
    // thread RESOLVED/CLOSED via a status edit. They must use the explicit
    // "propose resolution" action and let the resident confirm.
    if (
      this.isManagement(user) &&
      (dto.status === ThreadStatus.RESOLVED ||
        dto.status === ThreadStatus.CLOSED ||
        dto.status === ThreadStatus.PENDING_RESIDENT_CONFIRMATION)
    ) {
      throw new ForbiddenException(
        'Management cannot resolve a thread directly — propose resolution for the resident to confirm.',
      );
    }

    if (dto.priority && dto.priority !== thread.priority) {
      data.priority = dto.priority;
      const due = await this.sla.computeDueDates(thread.condoId, dto.priority, thread.createdAt);
      data.firstResponseDueAt = due.firstResponseDueAt;
      data.resolutionDueAt = due.resolutionDueAt;
      if (due.slaPolicyId) data.slaPolicy = { connect: { id: due.slaPolicyId } };
      systemLines.push(`Priority changed to ${dto.priority}`);
    }

    if (dto.category && dto.category !== thread.category) {
      data.category = dto.category;
      systemLines.push(`Category changed to ${dto.category}`);
      const meta = (thread.metadata as Record<string, unknown> | null) ?? {};
      const repeat = Boolean(meta.repeatComplainant);
      const newAssignee = await this.assignment.assignOnRecategorise(
        thread.condoId,
        dto.category,
        repeat,
      );
      if (newAssignee && newAssignee !== thread.assignedToUserId) {
        data.assignedTo = { connect: { id: newAssignee } };
        systemLines.push('Auto-reassigned after recategorisation');
      }
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

  // -- resident-driven resolution (D2) -------------------------------

  /** Management proposes a thread as resolved; the resident must confirm. */
  async proposeResolution(user: AuthenticatedUser, id: string, dto: ProposeResolutionDto) {
    const thread = await this.loadAndAuthorize(user, id);
    if (!this.isManagement(user)) {
      throw new ForbiddenException('Only management can propose a resolution');
    }
    if (thread.status === ThreadStatus.RESOLVED || thread.status === ThreadStatus.CLOSED) {
      throw new BadRequestException('This thread is already resolved');
    }
    // B13: block while resident owes a reply.
    if (thread.status === ThreadStatus.AWAITING_RESIDENT) {
      throw new BadRequestException(
        'Cannot propose resolution while awaiting a response from the resident',
      );
    }
    // B5/B6: management must have responded at least once.
    if (!thread.firstRespondedAt) {
      throw new BadRequestException('Respond to the resident before proposing a resolution');
    }

    const now = new Date();
    const note = dto.note?.trim();
    const isUpdate = thread.status === ThreadStatus.PENDING_RESIDENT_CONFIRMATION && dto.messageId;
    const systemBody = isUpdate
      ? 'Changed which reply is the fix.'
      : 'Marked as fixed — waiting for resident to confirm.';

    const proposedMessageId: string | null = dto.messageId ?? null;
    if (proposedMessageId) {
      const msg = await this.prisma.threadMessage.findFirst({
        where: { id: proposedMessageId, threadId: id, kind: ThreadMessageKind.MESSAGE },
      });
      if (!msg) throw new BadRequestException('Proposed solution message not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.thread.update({
        where: { id },
        data: {
          status: ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
          resolutionProposedAt: isUpdate ? thread.resolutionProposedAt : now,
          resolutionProposedByUserId: user.id,
          ...(proposedMessageId
            ? { resolutionProposedMessage: { connect: { id: proposedMessageId } } }
            : { resolutionProposedMessage: { disconnect: true } }),
          firstRespondedAt: thread.firstRespondedAt ?? now,
          lastMessageAt: now,
        },
      });
      if (note && !proposedMessageId) {
        await tx.threadMessage.create({
          data: {
            threadId: id,
            authorUserId: user.id,
            kind: ThreadMessageKind.MESSAGE,
            body: note,
          },
        });
      }
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.SYSTEM,
          body: systemBody,
        },
      });
      return u;
    });

    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
    await this.notifications.dispatch({
      userIds: [thread.createdByUserId].filter((uid) => uid !== user.id),
      kind: NotificationKind.THREAD_STATUS,
      title: 'Please confirm resolution',
      body: thread.subject,
      data: { threadId: id },
    });
    await this.writeAudit(thread, user, ['Resolution proposed — awaiting resident confirmation']);
    return updated;
  }

  /** Resident confirms (or rejects) a proposed resolution. Resident-driven. */
  async confirmResolution(user: AuthenticatedUser, id: string, dto: ConfirmResolutionDto) {
    const thread = await this.loadAndAuthorize(user, id);
    if (!this.canActAsResident(user, thread)) {
      throw new ForbiddenException('Only a household member can confirm resolution');
    }
    if (thread.status === ThreadStatus.CLOSED) {
      throw new BadRequestException('This thread is closed');
    }
    const now = new Date();

    if (dto.confirmed) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const u = await tx.thread.update({
          where: { id },
          data: {
            status: ThreadStatus.RESOLVED,
            resolvedAt: now,
            resolutionProposedAt: null,
            resolutionProposedByUserId: null,
            resolutionProposedMessage: { disconnect: true },
            lastMessageAt: now,
          },
        });
        await tx.threadMessage.create({
          data: {
            threadId: id,
            authorUserId: user.id,
            kind: ThreadMessageKind.SYSTEM,
            body: 'Resident confirmed — ticket closed.',
          },
        });
        return u;
      });
      this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
      await this.notifications.dispatch({
        userIds: await this.resolutionRecipients(thread, user.id),
        kind: NotificationKind.THREAD_STATUS,
        title: 'Thread resolved by resident',
        body: thread.subject,
        data: { threadId: id },
      });
      await this.writeAudit(thread, user, ['Resident confirmed resolution']);
      return updated;
    }

    // B3: reject requires why + what they still want.
    const rejectReason = dto.rejectReason?.trim();
    const rejectExpectation = dto.rejectExpectation?.trim();
    if (!rejectReason || !rejectExpectation) {
      throw new BadRequestException('Please explain why you are rejecting and what you still need');
    }

    const rejectBody = `**Why not resolved:** ${rejectReason}\n\n**What I still need:** ${rejectExpectation}`;

    // Not resolved → hand back to management and clear the proposal.
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.thread.update({
        where: { id },
        data: {
          status: ThreadStatus.AWAITING_MANAGEMENT,
          resolutionProposedAt: null,
          resolutionProposedByUserId: null,
          resolutionProposedMessage: { disconnect: true },
          lastMessageAt: now,
        },
      });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.MESSAGE,
          body: rejectBody,
        },
      });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.SYSTEM,
          body: "Resident said it's not fixed yet.",
        },
      });
      return u;
    });
    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
    await this.notifications.dispatch({
      userIds: await this.resolutionRecipients(thread, user.id),
      kind: NotificationKind.THREAD_STATUS,
      title: 'Resident says not resolved',
      body: thread.subject,
      data: { threadId: id },
    });
    await this.writeAudit(thread, user, ['Resident rejected resolution']);
    return updated;
  }

  /** Explicit reopen/appeal with required reason (B10); SLA continues from original due date (B12). */
  async appeal(user: AuthenticatedUser, id: string, dto: AppealThreadDto) {
    const thread = await this.loadAndAuthorize(user, id);
    if (!this.canActAsResident(user, thread)) {
      throw new ForbiddenException('Only a household member can appeal');
    }
    if (thread.status !== ThreadStatus.RESOLVED && thread.status !== ThreadStatus.CLOSED) {
      throw new BadRequestException('Appeal is only available on resolved or closed threads');
    }
    const now = new Date();
    const reason = dto.reason.trim();

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.thread.update({
        where: { id },
        data: {
          status: ThreadStatus.REOPENED,
          resolvedAt: null,
          closedAt: null,
          reopenCount: { increment: 1 },
          lastMessageAt: now,
        },
      });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.MESSAGE,
          body: `**Appeal / reopen:** ${reason}`,
        },
      });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.SYSTEM,
          body: 'Resident reopened this ticket.',
        },
      });
      return u;
    });

    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
    // B11: notify original assignee only.
    const recipients = thread.assignedToUserId ? [thread.assignedToUserId] : [];
    if (recipients.length) {
      await this.notifications.dispatch({
        userIds: recipients.filter((uid) => uid !== user.id),
        kind: NotificationKind.THREAD_STATUS,
        title: 'Thread appealed by resident',
        body: thread.subject,
        data: { threadId: id },
      });
    }
    await this.writeAudit(thread, user, ['Resident appealed / reopened thread']);
    return updated;
  }

  /** Management explicitly requests something from the resident → AWAITING_RESIDENT. */
  async requestResident(user: AuthenticatedUser, id: string, dto: RequestResidentDto) {
    const thread = await this.loadAndAuthorize(user, id);
    if (!this.isManagement(user)) {
      throw new ForbiddenException('Only management can request a response from the resident');
    }
    if (thread.status === ThreadStatus.CLOSED) {
      throw new BadRequestException('This thread is closed');
    }
    const now = new Date();
    const note = dto.body?.trim();

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.thread.update({
        where: { id },
        data: {
          status: ThreadStatus.AWAITING_RESIDENT,
          resolutionProposedAt: null,
          resolutionProposedByUserId: null,
          resolutionProposedMessage: { disconnect: true },
          firstRespondedAt: thread.firstRespondedAt ?? now,
          lastMessageAt: now,
        },
      });
      if (note) {
        await tx.threadMessage.create({
          data: {
            threadId: id,
            authorUserId: user.id,
            kind: ThreadMessageKind.MESSAGE,
            body: note,
          },
        });
      } else {
        await tx.threadMessage.create({
          data: {
            threadId: id,
            authorUserId: user.id,
            kind: ThreadMessageKind.SYSTEM,
            body: 'Waiting on resident to reply.',
          },
        });
      }
      return u;
    });

    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
    await this.notifications.dispatch({
      userIds: [thread.createdByUserId].filter((uid) => uid !== user.id),
      kind: NotificationKind.THREAD_MESSAGE,
      title: `Action needed: ${thread.subject}`,
      body: note ? note.slice(0, 140) : 'Management has requested a response from you.',
      data: { threadId: id },
    });
    await this.writeAudit(thread, user, ['Requested response from resident']);
    return updated;
  }

  private async resolutionRecipients(
    thread: { assignedToUserId: string | null; condoId: string },
    actorId: string,
  ): Promise<string[]> {
    const base = thread.assignedToUserId
      ? [thread.assignedToUserId]
      : await this.managementUserIds(thread.condoId);
    return base.filter((uid) => uid !== actorId);
  }

  private async writeAudit(
    thread: { id: string; condoId: string; unitId: string | null },
    user: AuthenticatedUser,
    changes: string[],
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        condoId: thread.condoId,
        unitId: thread.unitId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'Thread',
        resourceId: thread.id,
        metadata: { changes } as Prisma.InputJsonValue,
      },
    });
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

  /** D7: management flags and closes an abusive thread; resident is notified. */
  async closeAbusive(user: AuthenticatedUser, id: string, dto: CloseAbusiveThreadDto) {
    const thread = await this.loadAndAuthorize(user, id);
    if (!this.isManagement(user)) {
      throw new ForbiddenException('Only management can close abusive threads');
    }
    if (thread.status === ThreadStatus.CLOSED) {
      throw new BadRequestException('Thread is already closed');
    }
    const now = new Date();
    const reason = dto.reason.trim();
    const condo = await this.prisma.condo.findUnique({
      where: { id: thread.condoId },
      select: { timezone: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const meta = (thread.metadata as Record<string, unknown> | null) ?? {};
      const u = await tx.thread.update({
        where: { id },
        data: {
          status: ThreadStatus.CLOSED,
          closedAt: now,
          lastMessageAt: now,
          metadata: {
            ...meta,
            abusiveClose: true,
            abusiveCloseReason: reason,
            abusiveClosedByUserId: user.id,
            abusiveClosedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      await tx.threadMessage.create({
        data: {
          threadId: id,
          authorUserId: user.id,
          kind: ThreadMessageKind.SYSTEM,
          body: `Thread closed by management (abusive): ${reason}`,
        },
      });
      return u;
    });

    this.events.emit('thread.status', { threadId: id, condoId: thread.condoId });
    await this.notifications.dispatch({
      userIds: [thread.createdByUserId],
      kind: NotificationKind.THREAD_STATUS,
      title: 'Your thread was closed',
      body: reason.slice(0, 140),
      data: { threadId: id },
      timeZone: condo?.timezone,
    });
    await this.writeAudit(thread, user, [`Abusive thread closed: ${reason.slice(0, 200)}`]);
    return updated;
  }

  /** G2: export thread transcript as PDF (management or resident with access). */
  async exportPdf(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const _thread = await this.loadAndAuthorize(user, id);
    const isMgmt = this.isManagement(user);
    const full = await this.prisma.thread.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        unit: { select: { identifier: true } },
        condo: { select: { name: true } },
        messages: {
          where: isMgmt ? {} : { kind: { not: ThreadMessageKind.INTERNAL_NOTE } },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!full) throw new NotFoundException();

    const meta = [
      `Condo: ${full.condo.name}`,
      `Subject: ${full.subject}`,
      `Status: ${full.status} · Priority: ${full.priority}`,
      full.unit?.identifier ? `Unit: ${full.unit.identifier}` : '',
      `Requester: ${full.createdBy.name}`,
      full.assignedTo ? `Assignee: ${full.assignedTo.name}` : 'Assignee: Unassigned',
      `Exported: ${new Date().toISOString()}`,
    ].filter(Boolean);

    const buffer = buildThreadPdf({
      title: full.subject,
      meta,
      messages: full.messages.map((m) => ({
        author: m.author?.name ?? 'System',
        at: m.createdAt.toISOString(),
        body: m.body,
        kind: m.kind,
      })),
    });
    const safeName =
      full.subject
        .replace(/[^\w\s-]/g, '')
        .slice(0, 40)
        .trim() || 'thread';
    return { buffer, filename: `${safeName}-${id.slice(0, 8)}.pdf` };
  }
}
