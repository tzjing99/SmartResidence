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
  type DefectSeverity,
  DefectStatus,
  RoleId,
} from '@prisma/client';
import { defectReference } from '@smartresidence/shared-types';
import { buildDefectListPdf } from './defect-export';
import { canTransitionDefect } from './defect-transitions';
import type { AddDefectUpdateDto, CreateDefectDto, TransitionDefectDto } from './dto/defect.dto';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

const defectUserSelect = { id: true, name: true, email: true } as const;

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
    const where = { unitId, reportId: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.defect.findMany({
        where,
        include: {
          raisedBy: { select: defectUserSelect },
          assignedTo: { select: defectUserSelect },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.defect.count({ where }),
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
        include: {
          raisedBy: { select: defectUserSelect },
          assignedTo: { select: defectUserSelect },
          unit: { include: { block: true } },
          attachments: true,
        },
        // First-come-first-served: oldest submission first so the board and any
        // export read as a queue ordered by who raised the ticket first.
        orderBy: { createdAt: 'asc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.defect.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        MANAGEMENT_ROLES.includes(r.roleId) &&
        (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
    );
  }

  /**
   * Build a contractor-facing PDF of the condo's defects, ordered earliest
   * submission first and honouring the same status/severity/category filters as
   * the admin board. Management-only.
   */
  async exportCondoPdf(
    user: AuthenticatedUser,
    condoId: string,
    filters: { status?: DefectStatus; severity?: DefectSeverity; category?: string },
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Only management can export defects');
    }
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const where = {
      condoId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    };
    const defects = await this.prisma.defect.findMany({
      where,
      include: { unit: { include: { block: true } } },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });

    const filterBits: string[] = [];
    if (filters.status) filterBits.push(`Status ${filters.status}`);
    if (filters.severity) filterBits.push(`Severity ${filters.severity}`);
    if (filters.category) filterBits.push(`Category ${filters.category}`);

    const buffer = buildDefectListPdf({
      title: `Defect schedule - ${condo.name}`,
      meta: [
        `Generated: ${new Date().toISOString()}`,
        'Order: earliest submission first',
        filterBits.length ? `Filters: ${filterBits.join('  |  ')}` : 'Filters: none (all defects)',
        `Total: ${defects.length} defect(s)`,
      ],
      rows: defects.map((d) => ({
        reference: defectReference(d.id),
        severity: d.severity,
        status: d.status,
        title: d.title,
        unitLabel: d.unit
          ? `${d.unit.block ? `${d.unit.block.name} ` : ''}${d.unit.identifier}`
          : '-',
        category: d.category,
        description: d.description,
      })),
    });

    const safeName =
      condo.name
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'condo';
    const date = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `defects-${safeName}-${date}.pdf` };
  }

  async getOne(id: string) {
    const defect = await this.prisma.defect.findUnique({
      where: { id },
      include: {
        raisedBy: { select: defectUserSelect },
        assignedTo: { select: defectUserSelect },
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
    if (!canTransitionDefect(defect.status, dto.status)) {
      throw new BadRequestException(`Cannot move from ${defect.status} to ${dto.status}`);
    }
    const nextAssignee = dto.assignedToUserId ?? defect.assignedToUserId;
    const assigneeChanged = Boolean(
      dto.assignedToUserId && dto.assignedToUserId !== defect.assignedToUserId,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.defect.update({
        where: { id },
        data: {
          status: dto.status,
          assignedToUserId: nextAssignee,
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
      return result;
    });

    this.events.emit('defect.updated', {
      defectId: id,
      condoId: defect.condoId,
      statusFrom: defect.status,
      statusTo: dto.status,
      assigneeChanged,
      assignedToUserId: assigneeChanged ? nextAssignee : undefined,
      actorUserId: user.id,
    });
    return updated;
  }

  async addUpdate(id: string, user: AuthenticatedUser, dto: AddDefectUpdateDto) {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) throw new NotFoundException();

    const update = await this.prisma.$transaction(async (tx) => {
      const created = await tx.defectUpdate.create({
        data: {
          defectId: id,
          authorUserId: user.id,
          message: dto.message,
          isInternal: dto.isInternal ?? false,
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
            defectUpdateId: created.id,
            ownerKind: AttachmentOwner.DEFECT_UPDATE,
            status: AttachmentStatus.COMMITTED,
          },
        });
      }
      return tx.defectUpdate.findUnique({
        where: { id: created.id },
        include: { author: true, attachments: true },
      });
    });

    this.events.emit('defect.commented', {
      defectId: id,
      condoId: defect.condoId,
      authorUserId: user.id,
      isInternal: dto.isInternal ?? false,
    });
    return update;
  }
}
