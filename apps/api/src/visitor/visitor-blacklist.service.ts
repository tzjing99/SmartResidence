import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { isValidMalaysiaPhone, normalizeMalaysiaPhone } from '@smartresidence/shared-types';
import type {
  CreateVisitorBlacklistDto,
  UpdateVisitorBlacklistDto,
} from './dto/visitor-blacklist.dto';

export class VisitorBlacklistBlockedError extends ForbiddenException {
  constructor(reason: string) {
    super(`Visitor blocked — blacklist: ${reason}`);
  }
}

function normalizePlate(plate?: string | null): string | null {
  const trimmed = plate?.trim().toUpperCase().replace(/[\s-]/g, '');
  return trimmed || null;
}

function normalizeName(name?: string | null): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

@Injectable()
export class VisitorBlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCondo(condoId: string) {
    const items = await this.prisma.visitorBlacklist.findMany({
      where: { condoId },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return { items, total: items.length };
  }

  async create(condoId: string, user: AuthenticatedUser, dto: CreateVisitorBlacklistDto) {
    const phone = dto.phone ? this.normalizePhone(dto.phone) : null;
    const vehiclePlate = normalizePlate(dto.vehiclePlate);
    const name = dto.name?.trim() || null;
    const idNumber = dto.idNumber?.trim() || null;

    if (!name && !phone && !vehiclePlate && !idNumber) {
      throw new BadRequestException(
        'Provide at least one identifier (name, phone, plate, or ID number)',
      );
    }

    const entry = await this.prisma.visitorBlacklist.create({
      data: {
        condoId,
        name,
        phone,
        vehiclePlate,
        idNumber,
        reason: dto.reason.trim(),
        createdByUserId: user.id,
        expiresAt: dto.expiresAt ?? null,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.CREATE,
        resourceType: 'VisitorBlacklist',
        resourceId: entry.id,
      },
    });

    return entry;
  }

  async update(entryId: string, user: AuthenticatedUser, dto: UpdateVisitorBlacklistDto) {
    const existing = await this.prisma.visitorBlacklist.findUnique({ where: { id: entryId } });
    if (!existing) throw new NotFoundException('Blacklist entry not found');

    const data: Record<string, unknown> = {};
    if (dto.reason !== undefined) data.reason = dto.reason.trim();
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt;
    if (dto.name !== undefined) data.name = dto.name?.trim() || null;
    if (dto.idNumber !== undefined) data.idNumber = dto.idNumber?.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone ? this.normalizePhone(dto.phone) : null;
    if (dto.vehiclePlate !== undefined) data.vehiclePlate = normalizePlate(dto.vehiclePlate);

    const updated = await this.prisma.visitorBlacklist.update({
      where: { id: entryId },
      data,
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        condoId: existing.condoId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.UPDATE,
        resourceType: 'VisitorBlacklist',
        resourceId: entryId,
      },
    });

    return updated;
  }

  async remove(entryId: string, user: AuthenticatedUser) {
    const existing = await this.prisma.visitorBlacklist.findUnique({ where: { id: entryId } });
    if (!existing) throw new NotFoundException('Blacklist entry not found');

    await this.prisma.visitorBlacklist.delete({ where: { id: entryId } });

    await this.prisma.auditLog.create({
      data: {
        condoId: existing.condoId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action: AuditAction.DELETE,
        resourceType: 'VisitorBlacklist',
        resourceId: entryId,
      },
    });
  }

  /** Gate / registration guard — throws if any active entry matches. */
  async assertNotBlacklisted(
    condoId: string,
    input: {
      name?: string | null;
      phone?: string | null;
      vehiclePlate?: string | null;
      idNumber?: string | null;
    },
  ): Promise<void> {
    const match = await this.findMatch(condoId, input);
    if (match) throw new VisitorBlacklistBlockedError(match.reason);
  }

  async findMatch(
    condoId: string,
    input: {
      name?: string | null;
      phone?: string | null;
      vehiclePlate?: string | null;
      idNumber?: string | null;
    },
  ) {
    const now = new Date();
    const phone = input.phone ? normalizeMalaysiaPhone(input.phone) : null;
    const plate = normalizePlate(input.vehiclePlate);
    const name = normalizeName(input.name);
    const idNumber = input.idNumber?.trim() || null;

    const or: Array<Record<string, unknown>> = [];
    if (phone) or.push({ phone });
    if (plate) or.push({ vehiclePlate: plate });
    if (name) or.push({ name: { equals: name, mode: 'insensitive' as const } });
    if (idNumber) or.push({ idNumber });

    if (or.length === 0) return null;

    return this.prisma.visitorBlacklist.findFirst({
      where: {
        condoId,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: { OR: or },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private normalizePhone(phone: string): string {
    const normalized = normalizeMalaysiaPhone(phone);
    if (!isValidMalaysiaPhone(normalized)) {
      throw new BadRequestException('Enter a valid Malaysia mobile number');
    }
    return normalized;
  }
}
