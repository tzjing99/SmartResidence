import { PrismaService } from '@/prisma/prisma.service';
import { parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import { Injectable } from '@nestjs/common';
import { RoleId, type ThreadCategory, ThreadStatus } from '@prisma/client';

export interface AssignmentResult {
  assignedToUserId: string | null;
  repeatComplainant: boolean;
  duplicateSuggestions: Array<{ id: string; subject: string; category: ThreadCategory }>;
}

@Injectable()
export class ThreadAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async assignOnCreate(input: {
    condoId: string;
    unitId: string | null;
    createdByUserId: string;
    category: ThreadCategory;
    subject: string;
  }): Promise<AssignmentResult> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: input.condoId },
      select: { settings: true },
    });
    const helpdesk = parseHelpdeskSettings(condo?.settings);
    const auto = helpdesk.autoAssignment;

    const repeatComplainant = await this.isRepeatComplainant(
      input.condoId,
      input.createdByUserId,
      input.unitId,
    );

    let pool: string[] = [];
    if (repeatComplainant && auto?.seniorStaffPool?.length) {
      pool = auto.seniorStaffPool;
    } else if (auto) {
      const catPool = auto.categoryPools?.find((p) => p.category === input.category);
      if (catPool?.userIds?.length) {
        pool = catPool.userIds;
      } else if (input.category === 'GENERAL' && auto.generalTriagePool?.length) {
        pool = auto.generalTriagePool;
      }
    }

    const assignedToUserId = pool.length > 0 ? await this.roundRobin(pool, input.condoId) : null;
    const duplicateSuggestions = await this.findDuplicateSuggestions(
      input.condoId,
      input.subject,
      input.category,
    );

    return { assignedToUserId, repeatComplainant, duplicateSuggestions };
  }

  async assignOnRecategorise(
    condoId: string,
    category: ThreadCategory,
    repeatComplainant: boolean,
  ): Promise<string | null> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    const auto = parseHelpdeskSettings(condo?.settings).autoAssignment;
    if (!auto) return null;

    let pool: string[] = [];
    if (repeatComplainant && auto.seniorStaffPool?.length) {
      pool = auto.seniorStaffPool;
    } else {
      const catPool = auto.categoryPools?.find((p) => p.category === category);
      if (catPool?.userIds?.length) pool = catPool.userIds;
      else if (category === 'GENERAL' && auto.generalTriagePool?.length) {
        pool = auto.generalTriagePool;
      }
    }
    return pool.length > 0 ? this.roundRobin(pool, condoId) : null;
  }

  private async isRepeatComplainant(
    condoId: string,
    userId: string,
    unitId: string | null,
  ): Promise<boolean> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const count = await this.prisma.thread.count({
      where: {
        condoId,
        createdAt: { gte: since },
        OR: [{ createdByUserId: userId }, ...(unitId ? [{ unitId }] : [])],
        status: { not: ThreadStatus.CLOSED },
      },
    });
    return count >= 3;
  }

  private async roundRobin(pool: string[], condoId: string): Promise<string | null> {
    const valid = await this.prisma.roleAssignment.findMany({
      where: {
        condoId,
        userId: { in: pool },
        roleId: { in: [RoleId.MANAGEMENT_ADMIN, RoleId.MANAGEMENT_STAFF] },
        revokedAt: null,
      },
      select: { userId: true },
    });
    const ids = valid.map((r) => r.userId);
    if (ids.length === 0) return pool[0] ?? null;
    const recent = await this.prisma.thread.findFirst({
      where: { condoId, assignedToUserId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: { assignedToUserId: true },
    });
    if (!recent?.assignedToUserId) return ids[0] ?? null;
    const idx = ids.indexOf(recent.assignedToUserId);
    return ids[(idx + 1) % ids.length] ?? null;
  }

  private async findDuplicateSuggestions(
    condoId: string,
    subject: string,
    category: ThreadCategory,
  ): Promise<Array<{ id: string; subject: string; category: ThreadCategory }>> {
    const normalized = subject.toLowerCase().replace(/\s+/g, ' ').trim();
    const keywords = normalized.split(' ').filter((w) => w.length > 3);
    if (keywords.length === 0) return [];

    const open = await this.prisma.thread.findMany({
      where: {
        condoId,
        category,
        status: {
          in: [
            ThreadStatus.OPEN,
            ThreadStatus.AWAITING_RESIDENT,
            ThreadStatus.AWAITING_MANAGEMENT,
            ThreadStatus.REOPENED,
          ],
        },
      },
      select: { id: true, subject: true, category: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return open.filter((t) => {
      const other = t.subject.toLowerCase();
      const matches = keywords.filter((k) => other.includes(k)).length;
      return matches >= Math.min(2, keywords.length);
    });
  }
}
