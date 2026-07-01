import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { BookingService } from './booking.service';
import { CancelBookingDto, CreateBookingDto, RejectBookingDto } from './dto/booking.dto';
import { ListBookingsDto } from './dto/facility.dto';

@ApiTags('Bookings')
@ApiBearerAuth('access')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get('mine')
  @CheckAbility({ action: 'read', subject: 'Booking' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() page: PaginationDto) {
    return this.bookings.listMine(user, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Booking' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListBookingsDto,
  ) {
    return this.bookings.listForCondo(user, condoId, query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Booking' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bookings.get(user, id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Booking' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Booking', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Book a facility slot (overlap-checked, fee/deposit reused)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Post(':id/cancel')
  @CheckAbility({ action: 'cancel', subject: 'Booking' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Booking', resourceIdFrom: 'params.id' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancel(user, id, dto);
  }

  @Post(':id/approve')
  @CheckAbility({ action: 'approve', subject: 'Booking' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Booking', resourceIdFrom: 'params.id' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bookings.approve(user, id);
  }

  @Post(':id/reject')
  @CheckAbility({ action: 'reject', subject: 'Booking' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Booking', resourceIdFrom: 'params.id' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookings.reject(user, id, dto);
  }
}
