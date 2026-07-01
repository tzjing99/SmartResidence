import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, type Facility, RoleId } from '@prisma/client';
import { hhmmToMinutes } from '@smartresidence/shared-types';
import type {
  AvailabilityQueryDto,
  CreateFacilityDto,
  UpdateFacilityDto,
} from './dto/facility.dto';

@Injectable()
export class FacilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCondo(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { includeInactive?: boolean; limit: number; offset: number },
  ) {
    this.assertCondoAccess(actor, condoId);
    const manage = this.isManagement(actor, condoId);
    const where = {
      condoId,
      ...(manage && opts.includeInactive ? {} : { active: true }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.facility.findMany({
        where,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.facility.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async get(actor: AuthenticatedUser, id: string): Promise<Facility> {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException('Facility not found');
    this.assertCondoAccess(actor, facility.condoId);
    return facility;
  }

  async create(actor: AuthenticatedUser, dto: CreateFacilityDto) {
    this.assertManagement(actor, dto.condoId);
    this.validateWindow(dto.openTime ?? '08:00', dto.closeTime ?? '22:00');
    return this.prisma.facility.create({
      data: {
        condoId: dto.condoId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        capacity: dto.capacity ?? null,
        requiresApproval: dto.requiresApproval ?? false,
        bookingFee: dto.bookingFee ?? null,
        depositAmount: dto.depositAmount ?? null,
        openTime: dto.openTime ?? '08:00',
        closeTime: dto.closeTime ?? '22:00',
        slotMinutes: dto.slotMinutes ?? 60,
        maxConcurrent: dto.maxConcurrent ?? 1,
        active: dto.active ?? true,
        position: dto.position ?? 0,
      },
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateFacilityDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException('Facility not found');
    this.assertManagement(actor, facility.condoId);
    const openTime = dto.openTime ?? facility.openTime;
    const closeTime = dto.closeTime ?? facility.closeTime;
    this.validateWindow(openTime, closeTime);
    return this.prisma.facility.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        capacity: dto.capacity === undefined ? undefined : dto.capacity,
        requiresApproval: dto.requiresApproval,
        bookingFee: dto.bookingFee === undefined ? undefined : dto.bookingFee,
        depositAmount: dto.depositAmount === undefined ? undefined : dto.depositAmount,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        slotMinutes: dto.slotMinutes,
        maxConcurrent: dto.maxConcurrent,
        active: dto.active,
        position: dto.position,
      },
    });
  }

  async remove(actor: AuthenticatedUser, id: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException('Facility not found');
    this.assertManagement(actor, facility.condoId);
    // Soft-disable when future bookings exist; hard delete only when unused.
    const activeBookings = await this.prisma.booking.count({
      where: {
        facilityId: id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        endAt: { gte: new Date() },
      },
    });
    if (activeBookings > 0) {
      return this.prisma.facility.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.facility.delete({ where: { id } });
    return { ok: true };
  }

  /** Free/taken slots for a facility on a given local calendar day. */
  async availability(actor: AuthenticatedUser, id: string, query: AvailabilityQueryDto) {
    const facility = await this.get(actor, id);
    const day = this.parseDate(query.date);
    const openMinutes = hhmmToMinutes(facility.openTime);
    const closeMinutes = hhmmToMinutes(facility.closeTime);

    const dayStart = new Date(day);
    dayStart.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(Math.floor(closeMinutes / 60), closeMinutes % 60, 0, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        facilityId: id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
    });

    const slotMs = facility.slotMinutes * 60_000;
    const slots: Array<{
      startAt: Date;
      endAt: Date;
      booked: number;
      remaining: number;
      available: boolean;
    }> = [];
    for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime() + 1; t += slotMs) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + slotMs);
      const booked = bookings.filter(
        (b) => b.startAt.getTime() < slotEnd.getTime() && b.endAt.getTime() > slotStart.getTime(),
      ).length;
      const remaining = Math.max(0, facility.maxConcurrent - booked);
      slots.push({
        startAt: slotStart,
        endAt: slotEnd,
        booked,
        remaining,
        available: remaining > 0 && slotStart.getTime() >= Date.now() - slotMs,
      });
    }

    return {
      facilityId: id,
      date: query.date,
      slotMinutes: facility.slotMinutes,
      maxConcurrent: facility.maxConcurrent,
      slots,
    };
  }

  private parseDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) throw new BadRequestException('date must be YYYY-MM-DD');
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  private validateWindow(openTime: string, closeTime: string) {
    if (hhmmToMinutes(closeTime) <= hhmmToMinutes(openTime)) {
      throw new BadRequestException('closeTime must be after openTime');
    }
  }

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId),
    );
  }

  private assertManagement(user: AuthenticatedUser, condoId: string) {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Only management can manage facilities for this condo');
    }
  }

  private assertCondoAccess(user: AuthenticatedUser, condoId: string) {
    const ok = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
    if (!ok) throw new ForbiddenException('No access to this condo');
  }
}
