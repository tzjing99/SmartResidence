import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type PatrolCheckpoint, PatrolScanSource, Prisma, RoleId } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type {
  CreatePatrolCheckpointDto,
  ListPatrolScansDto,
  PatrolScanDto,
  UpdatePatrolCheckpointDto,
} from './dto/patrol.dto';

const scanInclude = {
  checkpoint: { select: { id: true, name: true } },
  guard: { select: { id: true, name: true } },
} satisfies Prisma.PatrolScanInclude;

/** Local midnight for an instant in a given IANA timezone. */
export function zonedStartOfDay(now: Date, timeZone: string): Date {
  const asUtc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asTz = new Date(now.toLocaleString('en-US', { timeZone }));
  const offsetMs = asTz.getTime() - asUtc.getTime();
  const tzNow = new Date(now.getTime() + offsetMs);
  tzNow.setUTCHours(0, 0, 0, 0);
  return new Date(tzNow.getTime() - offsetMs);
}

/** True when an active checkpoint has not been scanned within its interval. */
export function isCheckpointOverdue(
  checkpoint: Pick<PatrolCheckpoint, 'active' | 'expectedIntervalMinutes' | 'createdAt'>,
  lastScanAt: Date | null,
  now: Date,
): boolean {
  if (!checkpoint.active || !checkpoint.expectedIntervalMinutes) return false;
  const intervalMs = checkpoint.expectedIntervalMinutes * 60_000;
  const reference = lastScanAt ?? checkpoint.createdAt;
  return now.getTime() - reference.getTime() > intervalMs;
}

@Injectable()
export class PatrolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // -- checkpoints ----------------------------------------------------

  async listCheckpoints(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { includeInactive?: boolean } = {},
  ) {
    this.assertCondoAccess(actor, condoId);
    const manage = this.isManagement(actor, condoId);
    const where: Prisma.PatrolCheckpointWhereInput = {
      condoId,
      ...(manage && opts.includeInactive ? {} : { active: true }),
    };
    const checkpoints = await this.prisma.patrolCheckpoint.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return this.withStatus(condoId, checkpoints);
  }

  /** Enrich checkpoints with last scan + today's count + overdue flag. */
  private async withStatus(condoId: string, checkpoints: PatrolCheckpoint[]) {
    if (checkpoints.length === 0) return [];
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { timezone: true },
    });
    const tz = condo?.timezone ?? 'Asia/Kuala_Lumpur';
    const now = new Date();
    const dayStart = zonedStartOfDay(now, tz);
    const ids = checkpoints.map((c) => c.id);

    const [latest, todayCounts] = await Promise.all([
      this.prisma.patrolScan.findMany({
        where: { checkpointId: { in: ids } },
        orderBy: { scannedAt: 'desc' },
        distinct: ['checkpointId'],
        include: { guard: { select: { id: true, name: true } } },
      }),
      this.prisma.patrolScan.groupBy({
        by: ['checkpointId'],
        where: { checkpointId: { in: ids }, scannedAt: { gte: dayStart } },
        _count: { _all: true },
      }),
    ]);
    const latestByCp = new Map(latest.map((s) => [s.checkpointId, s]));
    const countByCp = new Map(todayCounts.map((c) => [c.checkpointId, c._count._all]));

    return checkpoints.map((cp) => {
      const last = latestByCp.get(cp.id);
      const lastScanAt = last?.scannedAt ?? null;
      return {
        ...cp,
        lastScanAt,
        lastScanGuardName: last?.guard?.name ?? null,
        scansToday: countByCp.get(cp.id) ?? 0,
        overdue: isCheckpointOverdue(cp, lastScanAt, now),
      };
    });
  }

  async createCheckpoint(actor: AuthenticatedUser, dto: CreatePatrolCheckpointDto) {
    this.assertManagement(actor, dto.condoId);
    return this.prisma.patrolCheckpoint.create({
      data: {
        condoId: dto.condoId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        code: this.generateCode(),
        active: dto.active ?? true,
        position: dto.position ?? 0,
        expectedIntervalMinutes: dto.expectedIntervalMinutes ?? null,
      },
    });
  }

  async updateCheckpoint(actor: AuthenticatedUser, id: string, dto: UpdatePatrolCheckpointDto) {
    const checkpoint = await this.prisma.patrolCheckpoint.findUnique({ where: { id } });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');
    this.assertManagement(actor, checkpoint.condoId);
    return this.prisma.patrolCheckpoint.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        active: dto.active,
        position: dto.position,
        expectedIntervalMinutes:
          dto.expectedIntervalMinutes === undefined ? undefined : dto.expectedIntervalMinutes,
      },
    });
  }

  /** Rotate the QR token (e.g. if a printed code is compromised). */
  async regenerateCode(actor: AuthenticatedUser, id: string) {
    const checkpoint = await this.prisma.patrolCheckpoint.findUnique({ where: { id } });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');
    this.assertManagement(actor, checkpoint.condoId);
    return this.prisma.patrolCheckpoint.update({
      where: { id },
      data: { code: this.generateCode() },
    });
  }

  async removeCheckpoint(actor: AuthenticatedUser, id: string) {
    const checkpoint = await this.prisma.patrolCheckpoint.findUnique({ where: { id } });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');
    this.assertManagement(actor, checkpoint.condoId);
    // Preserve scan history by soft-disabling when scans exist.
    const scanCount = await this.prisma.patrolScan.count({ where: { checkpointId: id } });
    if (scanCount > 0) {
      return this.prisma.patrolCheckpoint.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.patrolCheckpoint.delete({ where: { id } });
    return { ok: true };
  }

  // -- scans ----------------------------------------------------------

  /** Guard scans a checkpoint QR. Offline-tolerant (accepts source + scannedAt). */
  async scan(actor: AuthenticatedUser, dto: PatrolScanDto) {
    const checkpoint = await this.prisma.patrolCheckpoint.findUnique({
      where: { code: dto.code.trim() },
    });
    if (!checkpoint) throw new NotFoundException('Unknown checkpoint code');
    if (!checkpoint.active) throw new BadRequestException('This checkpoint is inactive');
    this.assertGuardOrManagement(actor, checkpoint.condoId);

    const scannedAt = dto.scannedAt ? new Date(dto.scannedAt) : new Date();
    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('Invalid scannedAt');
    }

    const scan = await this.prisma.patrolScan.create({
      data: {
        checkpointId: checkpoint.id,
        condoId: checkpoint.condoId,
        guardUserId: actor.id,
        scannedAt,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        note: dto.note?.trim() || null,
        source: dto.source ?? PatrolScanSource.ONLINE,
      },
      include: scanInclude,
    });

    // Clear the overdue flag so a fresh missed-check notification can fire later.
    if (checkpoint.lastOverdueNotifiedAt) {
      await this.prisma.patrolCheckpoint.update({
        where: { id: checkpoint.id },
        data: { lastOverdueNotifiedAt: null },
      });
    }

    this.events.emit('patrol.scanned', {
      condoId: checkpoint.condoId,
      checkpointId: checkpoint.id,
      scanId: scan.id,
    });
    return scan;
  }

  async listScans(actor: AuthenticatedUser, condoId: string, opts: ListPatrolScansDto) {
    this.assertGuardOrManagement(actor, condoId);
    const where: Prisma.PatrolScanWhereInput = {
      condoId,
      ...(opts.checkpointId ? { checkpointId: opts.checkpointId } : {}),
      ...(opts.guardUserId ? { guardUserId: opts.guardUserId } : {}),
      ...(opts.from || opts.to
        ? {
            scannedAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lt: new Date(opts.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patrolScan.findMany({
        where,
        include: scanInclude,
        orderBy: { scannedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.patrolScan.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  // -- overdue detection (schedule sweep) -----------------------------

  /**
   * Flag active checkpoints not scanned within their expected interval and
   * emit a `patrol.overdue` event per newly-overdue checkpoint (de-duped via
   * `lastOverdueNotifiedAt`). Returns the number of checkpoints flagged.
   */
  async detectOverdue(now = new Date()): Promise<number> {
    const checkpoints = await this.prisma.patrolCheckpoint.findMany({
      where: { active: true, expectedIntervalMinutes: { not: null } },
    });
    if (checkpoints.length === 0) return 0;

    const ids = checkpoints.map((c) => c.id);
    const latest = await this.prisma.patrolScan.findMany({
      where: { checkpointId: { in: ids } },
      orderBy: { scannedAt: 'desc' },
      distinct: ['checkpointId'],
      select: { checkpointId: true, scannedAt: true },
    });
    const lastByCp = new Map(latest.map((s) => [s.checkpointId, s.scannedAt]));

    let flagged = 0;
    for (const cp of checkpoints) {
      const lastScanAt = lastByCp.get(cp.id) ?? null;
      if (!isCheckpointOverdue(cp, lastScanAt, now)) continue;
      const intervalMs = (cp.expectedIntervalMinutes ?? 0) * 60_000;
      const alreadyNotified =
        cp.lastOverdueNotifiedAt && now.getTime() - cp.lastOverdueNotifiedAt.getTime() < intervalMs;
      if (alreadyNotified) continue;

      await this.prisma.patrolCheckpoint.update({
        where: { id: cp.id },
        data: { lastOverdueNotifiedAt: now },
      });
      this.events.emit('patrol.overdue', {
        condoId: cp.condoId,
        checkpointId: cp.id,
        lastScanAt: lastScanAt?.toISOString() ?? null,
      });
      flagged++;
    }
    return flagged;
  }

  // -- helpers --------------------------------------------------------

  private generateCode(): string {
    return `PTRL-${randomBytes(9).toString('base64url').toUpperCase().replace(/[-_]/g, '').slice(0, 12)}`;
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private isGuardOrManagement(user: AuthenticatedUser, condoId: string): boolean {
    return (
      this.isManagement(user, condoId) ||
      user.roles.some((r) => r.roleId === RoleId.SECURITY_GUARD && r.condoId === condoId)
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Management access required for this condo');
    }
  }

  private assertGuardOrManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isGuardOrManagement(user, condoId)) {
      throw new ForbiddenException('Guard or management access required for this condo');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }
}
