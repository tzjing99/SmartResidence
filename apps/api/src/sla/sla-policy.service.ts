import { AnnouncementService } from '@/announcement/announcement.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { SlaService } from '@/threads/sla/sla.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AnnouncementImportance,
  AuditAction,
  type Prisma,
  RoleId,
  ThreadPriority,
  ThreadStatus,
} from '@prisma/client';
import type { UpdateSlaPoliciesDto } from './dto/sla.dto';
import {
  DEFAULT_RESOLUTION_CONFIRMATION_GRACE_DAYS,
  mergeHelpdeskSettings,
  parseHelpdeskSettings,
} from './helpdesk-settings';
import {
  RECOMMENDED_RESOLUTION_MINS,
  type SlaBand,
  bandThresholds,
  classifyResolutionMins,
  deriveFirstResponseMins,
} from './sla-bands';

const ALL_PRIORITIES: ThreadPriority[] = [
  ThreadPriority.URGENT,
  ThreadPriority.HIGH,
  ThreadPriority.NORMAL,
  ThreadPriority.LOW,
];

const OPEN_STATUSES: ThreadStatus[] = [
  ThreadStatus.OPEN,
  ThreadStatus.AWAITING_RESIDENT,
  ThreadStatus.AWAITING_MANAGEMENT,
  ThreadStatus.REOPENED,
  ThreadStatus.PENDING_RESIDENT_CONFIRMATION,
];

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (24 * 60))}d`;
}

@Injectable()
export class SlaPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
    private readonly announcements: AnnouncementService,
    private readonly events: EventEmitter2,
  ) {}

  private managementCondoIds(user: AuthenticatedUser): string[] {
    const roles: RoleId[] = [RoleId.SUPER_ADMIN, RoleId.MANAGEMENT_ADMIN, RoleId.MANAGEMENT_STAFF];
    return Array.from(
      new Set(
        user.roles
          .filter((r) => roles.includes(r.roleId) && r.condoId)
          .map((r) => r.condoId as string),
      ),
    );
  }

  private isAdmin(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        (r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.SUPER_ADMIN) &&
        (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
    );
  }

  async getSettings(user: AuthenticatedUser, condoId: string) {
    if (!this.managementCondoIds(user).includes(condoId)) {
      throw new ForbiddenException();
    }
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const unitCount = await this.prisma.unit.count({ where: { condoId } });
    const helpdesk = parseHelpdeskSettings(condo.settings);
    const policies = await this.prisma.slaPolicy.findMany({
      where: { condoId, active: true },
      orderBy: { priority: 'asc' },
    });

    const policyMap = new Map(policies.map((p) => [p.priority, p]));
    const items = ALL_PRIORITIES.map((priority) => {
      const row = policyMap.get(priority);
      const resolutionMins = row?.resolutionMins ?? RECOMMENDED_RESOLUTION_MINS[priority];
      const firstResponseMins = row?.firstResponseMins ?? deriveFirstResponseMins(resolutionMins);
      const thresholds = bandThresholds(priority, unitCount);
      const band = classifyResolutionMins(priority, resolutionMins, unitCount);
      return {
        priority,
        id: row?.id ?? null,
        resolutionMins,
        firstResponseMins,
        band,
        thresholds,
        recommendedResolutionMins: RECOMMENDED_RESOLUTION_MINS[priority],
      };
    });

    return {
      condoId,
      unitCount,
      resolutionConfirmationGraceDays: helpdesk.resolutionConfirmationGraceDays,
      atRiskThresholdPercent: 20,
      policies: items,
      editable: this.isAdmin(user, condoId),
    };
  }

  async updateSettings(user: AuthenticatedUser, condoId: string, dto: UpdateSlaPoliciesDto) {
    if (!this.isAdmin(user, condoId)) {
      throw new ForbiddenException('Only management admins can edit SLA policies');
    }
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const unitCount = await this.prisma.unit.count({ where: { condoId } });
    const existing = await this.prisma.slaPolicy.findMany({ where: { condoId } });
    const existingMap = new Map(existing.map((p) => [p.priority, p]));
    const helpdesk = parseHelpdeskSettings(condo.settings);
    const graceDays =
      dto.resolutionConfirmationGraceDays ?? helpdesk.resolutionConfirmationGraceDays;

    const before: Array<{
      priority: ThreadPriority;
      resolutionMins: number;
      firstResponseMins: number;
    }> = ALL_PRIORITIES.map((priority) => {
      const row = existingMap.get(priority);
      const resolutionMins = row?.resolutionMins ?? RECOMMENDED_RESOLUTION_MINS[priority];
      return {
        priority,
        resolutionMins,
        firstResponseMins: row?.firstResponseMins ?? deriveFirstResponseMins(resolutionMins),
      };
    });

    const bands: SlaBand[] = [];
    const after: typeof before = [];
    for (const item of dto.policies) {
      const band = classifyResolutionMins(item.priority, item.resolutionMins, unitCount);
      bands.push(band);
      after.push({
        priority: item.priority,
        resolutionMins: item.resolutionMins,
        firstResponseMins: deriveFirstResponseMins(item.resolutionMins),
      });
    }

    const hasRisky = bands.includes('risky');
    if (hasRisky && !dto.riskyAcknowledged) {
      throw new BadRequestException(
        'One or more priorities are in the risky band — acknowledge the warning to proceed.',
      );
    }

    const now = new Date();
    let announcementId: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.policies) {
        const firstResponseMins = deriveFirstResponseMins(item.resolutionMins);
        await tx.slaPolicy.upsert({
          where: { condoId_priority: { condoId, priority: item.priority } },
          create: {
            condoId,
            priority: item.priority,
            firstResponseMins,
            resolutionMins: item.resolutionMins,
            active: true,
          },
          update: { firstResponseMins, resolutionMins: item.resolutionMins, active: true },
        });
      }

      const newSettings = mergeHelpdeskSettings(condo.settings, {
        resolutionConfirmationGraceDays: graceDays,
      });
      await tx.condo.update({
        where: { id: condoId },
        data: { settings: newSettings as Prisma.InputJsonValue },
      });

      const audit = await tx.auditLog.create({
        data: {
          condoId,
          actorUserId: user.id,
          actorRole: user.activeRole,
          action: AuditAction.UPDATE,
          resourceType: 'SlaPolicy',
          resourceId: condoId,
          metadata: {
            before,
            after,
            riskyAcknowledged: hasRisky,
            rationale: dto.rationale ?? null,
            graceDays,
          } as Prisma.InputJsonValue,
        },
      });

      if (hasRisky) {
        const table = after
          .map((row) => {
            const prev = before.find((b) => b.priority === row.priority);
            return `| ${row.priority} | ${formatMins(prev?.resolutionMins ?? 0)} → ${formatMins(row.resolutionMins)} |`;
          })
          .join('\n');

        const body = [
          '## Helpdesk response times updated',
          '',
          'Management has updated SLA response windows. New threads and reprioritisations will use these values immediately; open threads have had due dates recalculated.',
          '',
          `**Effective:** ${now.toLocaleDateString('en-MY', { timeZone: condo.timezone })}`,
          '',
          '| Priority | Resolution window |',
          '| --- | --- |',
          table,
          '',
          dto.rationale ? `**Rationale:** ${dto.rationale}` : '',
          '',
          `Audit reference: \`${audit.id}\``,
        ]
          .filter(Boolean)
          .join('\n');

        const announcement = await tx.announcement.create({
          data: {
            condoId,
            authorUserId: user.id,
            title: 'Helpdesk response times updated',
            body,
            importance: AnnouncementImportance.IMPORTANT,
            audience: { all: true } as object,
            publishedAt: now,
            pinned: false,
          },
        });
        announcementId = announcement.id;

        await tx.auditLog.update({
          where: { id: audit.id },
          data: {
            metadata: {
              before,
              after,
              riskyAcknowledged: true,
              rationale: dto.rationale ?? null,
              graceDays,
              announcementId,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return audit;
    });

    await this.recalculateOpenThreadDueDates(condoId);

    if (announcementId) {
      this.events.emit('announcement.published', { announcementId, condoId });
    }

    return {
      ok: true,
      auditId: result.id,
      announcementId,
      riskySave: hasRisky,
    };
  }

  async recalculateOpenThreadDueDates(condoId: string): Promise<number> {
    const threads = await this.prisma.thread.findMany({
      where: { condoId, status: { in: OPEN_STATUSES } },
    });
    let updated = 0;
    for (const thread of threads) {
      const due = await this.sla.computeDueDates(condoId, thread.priority, thread.createdAt);
      await this.prisma.thread.update({
        where: { id: thread.id },
        data: {
          slaPolicyId: due.slaPolicyId,
          firstResponseDueAt: due.firstResponseDueAt,
          resolutionDueAt: due.resolutionDueAt,
        },
      });
      updated++;
    }
    return updated;
  }

  async listAudit(
    user: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number },
  ) {
    const canMgmt = this.managementCondoIds(user).includes(condoId);
    const canOwner = user.roles.some(
      (r) => r.roleId === RoleId.UNIT_OWNER && r.condoId === condoId,
    );
    if (!canMgmt && !canOwner) throw new ForbiddenException();

    const where: Prisma.AuditLogWhereInput = {
      condoId,
      resourceType: 'SlaPolicy',
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getGracePeriodDays(condoId: string): Promise<number> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    if (!condo) return DEFAULT_RESOLUTION_CONFIRMATION_GRACE_DAYS;
    return parseHelpdeskSettings(condo.settings).resolutionConfirmationGraceDays;
  }
}
