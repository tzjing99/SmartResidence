import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, VisitorStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import type { CheckInVisitorDto, CreateVisitorDto } from './dto/visitor.dto';

@Injectable()
export class VisitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateVisitorDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const visitor = await this.prisma.visitor.create({
      data: {
        condoId: unit.condoId,
        unitId: unit.id,
        hostUserId: user.id,
        name: dto.name,
        identification: dto.identification,
        phone: dto.phone,
        vehiclePlate: dto.vehiclePlate,
        purpose: dto.purpose,
        expectedAt: dto.expectedAt,
        expectedDurationMins: dto.expectedDurationMins,
        qrCode: nanoid(24),
        status: VisitorStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    });

    this.events.emit('visitor.created', { visitorId: visitor.id, condoId: visitor.condoId });
    return visitor;
  }

  async getQrPng(visitorId: string): Promise<{ qrCode: string; png: string }> {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    const png = await QRCode.toDataURL(visitor.qrCode, { errorCorrectionLevel: 'M', width: 512 });
    return { qrCode: visitor.qrCode, png };
  }

  async listForUnit(unitId: string, opts: { limit: number; offset: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where: { unitId },
        orderBy: { expectedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        include: { checkIns: true },
      }),
      this.prisma.visitor.count({ where: { unitId } }),
    ]);
    return { items, total, ...opts };
  }

  async listForCondo(
    condoId: string,
    opts: { limit: number; offset: number; status?: VisitorStatus },
  ) {
    const where = { condoId, ...(opts.status ? { status: opts.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        orderBy: { expectedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        include: { unit: true, host: true, checkIns: true },
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async cancel(visitorId: string, user: AuthenticatedUser) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new NotFoundException();
    if (visitor.hostUserId !== user.id) {
      throw new BadRequestException('Only the host can cancel this visitor');
    }
    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { status: VisitorStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async verifyByQr(qrCode: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { qrCode },
      include: { unit: { include: { block: true } }, host: true },
    });
    if (!visitor) throw new NotFoundException('Unknown QR code');
    return visitor;
  }

  async checkIn(qrCode: string, guard: AuthenticatedUser, dto: CheckInVisitorDto) {
    const visitor = await this.verifyByQr(qrCode);
    if (visitor.status === VisitorStatus.CHECKED_IN) {
      throw new BadRequestException('Visitor already checked in');
    }
    const update = await this.prisma.$transaction(async (tx) => {
      await tx.visitor.update({
        where: { id: visitor.id },
        data: { status: VisitorStatus.CHECKED_IN },
      });
      const checkIn = await tx.visitorCheckIn.create({
        data: {
          visitorId: visitor.id,
          checkInGuardId: guard.id,
          gateLocation: dto.gateLocation ?? null,
          notes: dto.notes ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: visitor.condoId,
          unitId: visitor.unitId,
          actorUserId: guard.id,
          actorRole: guard.activeRole,
          action: AuditAction.CREATE,
          resourceType: 'VisitorCheckIn',
          resourceId: checkIn.id,
        },
      });
      return checkIn;
    });
    this.events.emit('visitor.checked_in', { visitorId: visitor.id, condoId: visitor.condoId });
    return update;
  }

  async checkOut(qrCode: string, guard: AuthenticatedUser) {
    const visitor = await this.verifyByQr(qrCode);
    const lastCheckIn = await this.prisma.visitorCheckIn.findFirst({
      where: { visitorId: visitor.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!lastCheckIn) throw new BadRequestException('No active check-in for this visitor');

    const updated = await this.prisma.visitorCheckIn.update({
      where: { id: lastCheckIn.id },
      data: { checkOutAt: new Date(), checkOutGuardId: guard.id },
    });
    await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { status: VisitorStatus.CHECKED_OUT },
    });
    this.events.emit('visitor.checked_out', { visitorId: visitor.id, condoId: visitor.condoId });
    return updated;
  }
}
