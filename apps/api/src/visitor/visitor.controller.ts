import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, type VisitorStatus } from '@prisma/client';
import { CheckInVisitorDto, CreateVisitorDto } from './dto/visitor.dto';
import { VisitorService } from './visitor.service';

@ApiTags('Visitors')
@ApiBearerAuth('access')
@Controller('visitors')
export class VisitorController {
  constructor(private readonly visitors: VisitorService) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Pre-register a visitor for one of my units' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVisitorDto) {
    return this.visitors.create(user, dto);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  forUnit(@Param('unitId', new ParseUUIDPipe()) unitId: string, @Query() page: PaginationDto) {
    return this.visitors.listForUnit(unitId, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  forCondo(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() page: PaginationDto,
    @Query('status') status?: VisitorStatus,
  ) {
    return this.visitors.listForCondo(condoId, { ...page, status });
  }

  @Get(':id/qr')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  qr(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.visitors.getQrPng(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: AuditAction.DELETE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.visitors.cancel(id, user);
  }

  @Post('verify/:qr')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @ApiOperation({ summary: 'Guard scans QR to verify a visitor pass' })
  verify(@Param('qr') qr: string) {
    return this.visitors.verifyByQr(qr);
  }

  @Post('check-in/:qr')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'VisitorCheckIn' })
  checkIn(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('qr') qr: string,
    @Body() dto: CheckInVisitorDto,
  ) {
    return this.visitors.checkIn(qr, guard, dto);
  }

  @Post('check-out/:qr')
  @CheckAbility({ action: 'check-out', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VisitorCheckIn' })
  checkOut(@CurrentUser() guard: AuthenticatedUser, @Param('qr') qr: string) {
    return this.visitors.checkOut(qr, guard);
  }
}
