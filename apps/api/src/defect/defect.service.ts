import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttachmentOwner, AttachmentStatus, DefectStatus } from '@prisma/client';
import type { AddDefectUpdateDto, CreateDefectDto, TransitionDefectDto } from './dto/defect.dto';

const VALID_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  NEW: ['ACK', 'ASSIGNED', 'CLOSED'],
  ACK: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};

@Injectable()
export class DefectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateDefectDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const defect = await this.prisma.defect.create({
      data: {
        condoId: unit.condoId,
        unitId: unit.id,
        raisedByUserId: user.id,
        category: dto.category,
        severity: dto.severity ?? 'MEDIUM',
        title: dto.title,
        description: dto.description,
        location: dto.location,
        status: DefectStatus.NEW,
      },
    });

    if (dto.attachmentIds?.length) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploadedByUserId: user.id,
          ownerKind: AttachmentOwner.GENERIC,
        },
        data: {
          defectId: defect.id,
          ownerKind: AttachmentOwner.DEFECT,
          status: AttachmentStatus.COMMITTED,
        },
      });
    }

    this.events.emit('defect.created', { defectId: defect.id, condoId: defect.condoId });
    return defect;
  }

  async listForUnit(unitId: string, opts: { limit: number; offset: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.defect.findMany({
        where: { unitId },
        include: { raisedBy: true, assignedTo: true, attachments: true },
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.defect.count({ where: { unitId } }),
    ]);
    return { items, total, ...opts };
  }

  async listForCondo(
    condoId: string,
    opts: { limit: number; offset: number; status?: DefectStatus },
  ) {
    const where = { condoId, ...(opts.status ? { status: opts.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.defect.findMany({
        where,
        include: { raisedBy: true, assignedTo: true, unit: true, attachments: true },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.defect.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getOne(id: string) {
    const defect = await this.prisma.defect.findUnique({
      where: { id },
      include: {
        raisedBy: true,
        assignedTo: true,
        unit: { include: { block: true } },
        attachments: true,
        updates: {
          orderBy: { createdAt: 'asc' },
          include: { author: true, attachments: true },
        },
      },
    });
    if (!defect) throw new NotFoundException();
    return defect;
  }

  async transition(id: string, user: AuthenticatedUser, dto: TransitionDefectDto) {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) throw new NotFoundException();
    const allowed = VALID_TRANSITIONS[defect.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot move from ${defect.status} to ${dto.status}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.defect.update({
        where: { id },
        data: {
          status: dto.status,
          assignedToUserId: dto.assignedToUserId ?? defect.assignedToUserId,
          acknowledgedAt: dto.status === 'ACK' ? new Date() : defect.acknowledgedAt,
          resolvedAt: dto.status === 'RESOLVED' ? new Date() : defect.resolvedAt,
          closedAt: dto.status === 'CLOSED' ? new Date() : defect.closedAt,
        },
      });
      await tx.defectUpdate.create({
        data: {
          defectId: id,
          authorUserId: user.id,
          message: dto.message ?? `Status changed to ${dto.status}`,
          statusFrom: defect.status,
          statusTo: dto.status,
        },
      });
      this.events.emit('defect.updated', { defectId: id, condoId: defect.condoId });
      return updated;
    });
  }

  async addUpdate(id: string, user: AuthenticatedUser, dto: AddDefectUpdateDto) {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) throw new NotFoundException();
    return this.prisma.defectUpdate.create({
      data: {
        defectId: id,
        authorUserId: user.id,
        message: dto.message,
        isInternal: dto.isInternal ?? false,
      },
    });
  }
}
