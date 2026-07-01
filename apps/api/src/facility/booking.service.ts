import { BillingService } from '@/billing/billing.service';
import { DepositService } from '@/billing/deposit.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  type Booking,
  BookingStatus,
  DepositType,
  type Facility,
  Prisma,
  RoleId,
} from '@prisma/client';
import { hhmmToMinutes } from '@smartresidence/shared-types';
import type { CancelBookingDto, CreateBookingDto, RejectBookingDto } from './dto/booking.dto';
import type { ListBookingsDto } from './dto/facility.dto';

const bookingInclude = {
  facility: { select: { id: true, name: true, requiresApproval: true } },
  unit: { select: { id: true, identifier: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly billing: BillingService,
    private readonly deposits: DepositService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateBookingDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new NotFoundException('Facility not found');
    if (!facility.active) throw new BadRequestException('This facility is not accepting bookings');
    this.assertCondoAccess(actor, facility.condoId);

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    this.validateInterval(facility, start, end);

    if (dto.unitId) await this.assertActsForUnit(actor, dto.unitId, facility.condoId);

    const autoConfirm = !facility.requiresApproval;
    const fee = autoConfirm ? Number(facility.bookingFee ?? 0) : 0;
    const depositAmount = autoConfirm ? Number(facility.depositAmount ?? 0) : 0;

    const created = await this.prisma.$transaction(
      async (tx) => {
        await this.assertNoConflict(tx, facility, start, end);

        let booking = await tx.booking.create({
          data: {
            facilityId: facility.id,
            condoId: facility.condoId,
            unitId: dto.unitId ?? null,
            userId: actor.id,
            startAt: start,
            endAt: end,
            status: autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
            notes: dto.notes?.trim() || null,
          },
        });

        if (autoConfirm) {
          booking = await this.settleMoney(tx, booking, facility, actor);
        }

        await tx.auditLog.create({
          data: {
            condoId: facility.condoId,
            unitId: dto.unitId ?? null,
            actorUserId: actor.id,
            actorRole: actor.activeRole ?? undefined,
            action: AuditAction.CREATE,
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: {
              facilityId: facility.id,
              status: booking.status,
              fee,
              depositHeld: depositAmount,
            },
          },
        });

        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.events.emit('booking.created', {
      condoId: facility.condoId,
      bookingId: created.id,
      facilityId: facility.id,
      userId: created.userId,
      status: created.status,
    });
    if (created.status === BookingStatus.CONFIRMED) {
      this.emitConfirmed(created);
    }
    return this.get(actor, created.id);
  }

  async listForCondo(actor: AuthenticatedUser, condoId: string, opts: ListBookingsDto) {
    this.assertManagement(actor, condoId);
    const where: Prisma.BookingWhereInput = {
      condoId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.facilityId ? { facilityId: opts.facilityId } : {}),
      ...(opts.upcoming ? { endAt: { gte: new Date() } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startAt: opts.upcoming ? 'asc' : 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async listMine(actor: AuthenticatedUser, opts: { limit: number; offset: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: { userId: actor.id },
        include: bookingInclude,
        orderBy: { startAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.booking.count({ where: { userId: actor.id } }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const owns = booking.userId === actor.id;
    if (!owns && !this.isManagement(actor, booking.condoId)) {
      throw new ForbiddenException('You cannot view this booking');
    }
    return booking;
  }

  async approve(actor: AuthenticatedUser, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertManagement(actor, booking.condoId);
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be approved');
    }
    const facility = await this.prisma.facility.findUniqueOrThrow({
      where: { id: booking.facilityId },
    });

    const confirmed = await this.prisma.$transaction(
      async (tx) => {
        await this.assertNoConflict(tx, facility, booking.startAt, booking.endAt, booking.id);
        const updated = await tx.booking.update({
          where: { id },
          data: {
            status: BookingStatus.CONFIRMED,
            reviewedByUserId: actor.id,
            reviewedAt: new Date(),
          },
        });
        const withMoney = await this.settleMoney(tx, updated, facility, actor);
        await tx.auditLog.create({
          data: {
            condoId: booking.condoId,
            unitId: booking.unitId,
            actorUserId: actor.id,
            actorRole: actor.activeRole ?? undefined,
            action: AuditAction.UPDATE,
            resourceType: 'Booking',
            resourceId: id,
            metadata: { status: BookingStatus.CONFIRMED },
          },
        });
        return withMoney;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.emitConfirmed(confirmed);
    return this.get(actor, id);
  }

  async reject(actor: AuthenticatedUser, id: string, dto: RejectBookingDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertManagement(actor, booking.condoId);
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be rejected');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.REJECTED,
          reviewedByUserId: actor.id,
          reviewedAt: new Date(),
          notes: dto.reason
            ? `${booking.notes ? `${booking.notes}\n` : ''}Rejected: ${dto.reason}`
            : booking.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: booking.condoId,
          unitId: booking.unitId,
          actorUserId: actor.id,
          actorRole: actor.activeRole ?? undefined,
          action: AuditAction.UPDATE,
          resourceType: 'Booking',
          resourceId: id,
          metadata: { status: BookingStatus.REJECTED, reason: dto.reason ?? null },
        },
      });
    });
    this.events.emit('booking.rejected', {
      condoId: booking.condoId,
      bookingId: id,
      userId: booking.userId,
    });
    return this.get(actor, id);
  }

  async cancel(actor: AuthenticatedUser, id: string, dto: CancelBookingDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const owns = booking.userId === actor.id;
    if (!owns && !this.isManagement(actor, booking.condoId)) {
      throw new ForbiddenException('You cannot cancel this booking');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException('This booking can no longer be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: dto.reason
            ? `${booking.notes ? `${booking.notes}\n` : ''}Cancelled: ${dto.reason}`
            : booking.notes,
        },
      });
      // Money policy on cancellation: fully release any still-held deposit and
      // void the fee invoice when it is still unpaid. Partly/fully paid fee
      // invoices are left for management to settle via the billing tools.
      if (booking.depositId) {
        await this.deposits.refundHeldInTx(tx, booking.depositId, actor.id);
      }
      if (booking.invoiceId) {
        await this.billing.voidUnpaidInvoiceInTx(
          tx,
          booking.invoiceId,
          actor.id,
          'Booking cancelled',
        );
      }
      await tx.auditLog.create({
        data: {
          condoId: booking.condoId,
          unitId: booking.unitId,
          actorUserId: actor.id,
          actorRole: actor.activeRole ?? undefined,
          action: AuditAction.UPDATE,
          resourceType: 'Booking',
          resourceId: id,
          metadata: {
            status: BookingStatus.CANCELLED,
            reason: dto.reason ?? null,
            byManagement: !owns,
          },
        },
      });
    });

    this.events.emit('booking.cancelled', {
      condoId: booking.condoId,
      bookingId: id,
      userId: booking.userId,
      byManagement: !owns,
      actorUserId: actor.id,
    });
    return this.get(actor, id);
  }

  // -- internals ------------------------------------------------------

  /**
   * Prevent double-booking. Counts PENDING/CONFIRMED bookings whose interval
   * overlaps the requested one and rejects when the count reaches the
   * facility's `maxConcurrent`. Runs inside a Serializable transaction so
   * concurrent creates cannot both slip past the check. A DB exclusion
   * constraint would be stronger but is awkward with Prisma; the
   * transaction-level check is the documented, simpler choice.
   */
  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    facility: Facility,
    start: Date,
    end: Date,
    ignoreBookingId?: string,
  ) {
    const overlapping = await tx.booking.count({
      where: {
        facilityId: facility.id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startAt: { lt: end },
        endAt: { gt: start },
        ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      },
    });
    if (overlapping >= facility.maxConcurrent) {
      throw new ConflictException(
        'That time slot is already fully booked. Please pick another slot.',
      );
    }
  }

  /**
   * Create the fee invoice and/or hold the deposit for a confirmed booking,
   * reusing the billing invoice + deposit systems. Returns the booking updated
   * with fee/depositHeld snapshots and invoiceId/depositId links.
   */
  private async settleMoney(
    tx: Prisma.TransactionClient,
    booking: Booking,
    facility: Facility,
    actor: AuthenticatedUser,
  ): Promise<Booking> {
    const fee = Number(facility.bookingFee ?? 0);
    const depositAmount = Number(facility.depositAmount ?? 0);
    if (fee <= 0 && depositAmount <= 0) return booking;
    if (!booking.unitId) {
      // Money requires a unit to attribute the invoice/deposit to.
      throw new BadRequestException(
        'This facility requires a fee/deposit — please book on behalf of your unit.',
      );
    }

    const data: Prisma.BookingUpdateInput = {};
    if (fee > 0) {
      const invoice = await this.billing.createInvoiceInTx(tx, {
        condoId: facility.condoId,
        unitId: booking.unitId,
        dueDate: booking.startAt,
        periodStart: booking.startAt,
        periodEnd: booking.endAt,
        actorUserId: actor.id,
        metadata: { bookingId: booking.id, facilityId: facility.id },
        lines: [
          {
            code: 'FACILITY',
            description: `${facility.name} booking — ${booking.startAt.toLocaleString('en-MY')}`,
            unitPrice: fee,
          },
        ],
      });
      data.invoiceId = invoice.id;
      data.fee = fee;
    }
    if (depositAmount > 0) {
      const { deposit } = await this.deposits.recordInTx(tx, {
        condoId: facility.condoId,
        unitId: booking.unitId,
        userId: booking.userId,
        type: DepositType.OTHER,
        amount: depositAmount,
        description: `${facility.name} booking deposit`,
        notes: `Facility booking ${booking.id}`,
        recordedByUserId: actor.id,
        metadata: { bookingId: booking.id, facilityId: facility.id },
      });
      data.depositId = deposit.id;
      data.depositHeld = depositAmount;
    }
    return tx.booking.update({ where: { id: booking.id }, data });
  }

  private emitConfirmed(booking: Booking) {
    this.events.emit('booking.confirmed', {
      condoId: booking.condoId,
      bookingId: booking.id,
      userId: booking.userId,
    });
    if (booking.invoiceId) {
      this.events.emit('invoice.issued', { invoiceId: booking.invoiceId });
    }
  }

  private validateInterval(facility: Facility, start: Date, end: Date) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }
    if (start.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Cannot book a slot in the past');
    }
    const durationMin = (end.getTime() - start.getTime()) / 60_000;
    if (durationMin < facility.slotMinutes) {
      throw new BadRequestException(`Minimum booking length is ${facility.slotMinutes} minutes`);
    }
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const openMin = hhmmToMinutes(facility.openTime);
    const closeMin = hhmmToMinutes(facility.closeTime);
    if (startMin < openMin || endMin > closeMin) {
      throw new BadRequestException(
        `Bookings must fall within ${facility.openTime}–${facility.closeTime}`,
      );
    }
  }

  private async assertActsForUnit(actor: AuthenticatedUser, unitId: string, condoId: string) {
    if (this.isManagement(actor, condoId)) return;
    const belongs = actor.roles.some((r) => r.unitId === unitId);
    if (belongs) return;
    const [ownership, tenancy] = await Promise.all([
      this.prisma.ownership.findFirst({ where: { userId: actor.id, unitId, status: 'ACTIVE' } }),
      this.prisma.tenancy.findFirst({ where: { userId: actor.id, unitId, status: 'ACTIVE' } }),
    ]);
    if (!ownership && !tenancy) {
      throw new ForbiddenException('You are not a resident of the selected unit');
    }
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Management access required for this condo');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }
}
