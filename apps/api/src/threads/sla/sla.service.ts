import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  NotificationKind,
  type Prisma,
  RoleId,
  ThreadPriority,
  ThreadStatus,
} from '@prisma/client';

export type SlaState = 'NONE' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

/** Fallback SLA windows (in minutes) used when a condo has no SlaPolicy row. */
const DEFAULT_SLA: Record<ThreadPriority, { firstResponseMins: number; resolutionMins: number }> = {
  URGENT: { firstResponseMins: 60, resolutionMins: 4 * 60 },
  HIGH: { firstResponseMins: 4 * 60, resolutionMins: 24 * 60 },
  NORMAL: { firstResponseMins: 8 * 60, resolutionMins: 3 * 24 * 60 },
  LOW: { firstResponseMins: 24 * 60, resolutionMins: 7 * 24 * 60 },
};

/** Statuses where the SLA clock is still meaningful. */
const ACTIVE_STATUSES: ThreadStatus[] = [
  ThreadStatus.OPEN,
  ThreadStatus.AWAITING_RESIDENT,
  ThreadStatus.AWAITING_MANAGEMENT,
  ThreadStatus.REOPENED,
];

interface SlaThreadShape {
  status: ThreadStatus;
  createdAt: Date;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
}

const RANK: Record<SlaState, number> = { NONE: 0, ON_TRACK: 1, AT_RISK: 2, BREACHED: 3 };

@Injectable()
export class SlaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SCAN_INTERVAL_MS = 5 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.scanForBreaches().catch((err) =>
        this.logger.warn(`SLA breach scan failed: ${(err as Error).message}`),
      );
    }, SlaService.SCAN_INTERVAL_MS);
    // Don't keep short-lived processes (scripts, tests) alive on this timer.
    this.timer.unref?.();
    this.logger.log('SLA breach scanner started (interval 5m)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Resolve the effective SLA window for a condo+priority (policy row or default). */
  async resolvePolicy(
    condoId: string,
    priority: ThreadPriority,
  ): Promise<{ slaPolicyId: string | null; firstResponseMins: number; resolutionMins: number }> {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { condoId_priority: { condoId, priority } },
    });
    if (policy?.active) {
      return {
        slaPolicyId: policy.id,
        firstResponseMins: policy.firstResponseMins,
        resolutionMins: policy.resolutionMins,
      };
    }
    return { slaPolicyId: policy?.id ?? null, ...DEFAULT_SLA[priority] };
  }

  /** Compute first-response and resolution due dates for a new/repriotised thread. */
  async computeDueDates(
    condoId: string,
    priority: ThreadPriority,
    from: Date = new Date(),
  ): Promise<{ slaPolicyId: string | null; firstResponseDueAt: Date; resolutionDueAt: Date }> {
    const p = await this.resolvePolicy(condoId, priority);
    return {
      slaPolicyId: p.slaPolicyId,
      firstResponseDueAt: new Date(from.getTime() + p.firstResponseMins * 60_000),
      resolutionDueAt: new Date(from.getTime() + p.resolutionMins * 60_000),
    };
  }

  /**
   * Derive the SLA health of a thread. Returns the worst of the first-response
   * and resolution clocks. AT_RISK once less than 20% of the window remains.
   */
  computeSlaState(thread: SlaThreadShape, now: Date = new Date()): SlaState {
    if (thread.status === ThreadStatus.RESOLVED || thread.status === ThreadStatus.CLOSED) {
      return 'NONE';
    }
    const clocks: Array<{ due: Date | null; done: Date | null }> = [
      { due: thread.firstResponseDueAt, done: thread.firstRespondedAt },
      { due: thread.resolutionDueAt, done: thread.resolvedAt },
    ];
    let worst: SlaState = 'NONE';
    for (const clock of clocks) {
      if (!clock.due || clock.done) continue;
      let state: SlaState;
      if (now.getTime() > clock.due.getTime()) {
        state = 'BREACHED';
      } else {
        const window = clock.due.getTime() - thread.createdAt.getTime();
        const remaining = clock.due.getTime() - now.getTime();
        state = window > 0 && remaining < window * 0.2 ? 'AT_RISK' : 'ON_TRACK';
      }
      if (RANK[state] > RANK[worst]) worst = state;
    }
    return worst;
  }

  /** Periodic scan: escalate threads that have breached an SLA clock once. */
  async scanForBreaches(): Promise<void> {
    const now = new Date();
    const breached = await this.prisma.thread.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          { firstRespondedAt: null, firstResponseDueAt: { lt: now } },
          { resolvedAt: null, resolutionDueAt: { lt: now } },
        ],
      },
    });
    for (const thread of breached) {
      const meta = (thread.metadata as Record<string, unknown> | null) ?? {};
      if (meta.slaEscalatedAt) continue;
      await this.escalate(
        thread.id,
        thread.condoId,
        thread.unitId,
        thread.subject,
        thread.assignedToUserId,
        meta,
        now,
      );
    }
    if (breached.length > 0) {
      this.logger.warn(`SLA scan flagged ${breached.length} thread(s)`);
    }
  }

  private async escalate(
    threadId: string,
    condoId: string,
    unitId: string | null,
    subject: string,
    assignedToUserId: string | null,
    meta: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    const managers = await this.prisma.roleAssignment.findMany({
      where: {
        condoId,
        roleId: { in: [RoleId.MANAGEMENT_ADMIN, RoleId.MANAGEMENT_STAFF] },
        revokedAt: null,
      },
      select: { userId: true },
    });
    const userIds = new Set(managers.map((m) => m.userId));
    if (assignedToUserId) userIds.add(assignedToUserId);

    await this.notifications.dispatch({
      userIds: [...userIds],
      kind: NotificationKind.THREAD_SLA_ESCALATION,
      title: 'SLA breach',
      body: `Thread "${subject}" has breached its response/resolution SLA.`,
      data: { threadId },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId,
        unitId,
        action: AuditAction.UPDATE,
        resourceType: 'Thread',
        resourceId: threadId,
        metadata: { slaBreach: true } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.thread.update({
      where: { id: threadId },
      data: { metadata: { ...meta, slaEscalatedAt: now.toISOString() } as Prisma.InputJsonValue },
    });

    this.events.emit('thread.sla.escalation', { threadId, condoId });
  }
}
