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
import {
  CheckInVisitorDto,
  CreateVisitorDto,
  CreateWalkInOfficeDto,
  CreateWalkInUnitDto,
  RejectVisitorDto,
} from './dto/visitor.dto';
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

  @Post('walk-in/unit')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Guard registers a walk-in visitor awaiting unit owner approval' })
  walkInUnit(@CurrentUser() guard: AuthenticatedUser, @Body() dto: CreateWalkInUnitDto) {
    return this.visitors.createWalkInUnit(guard, dto);
  }

  @Post('walk-in/office')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Guard logs a management office visitor (immediate check-in)' })
  walkInOffice(@CurrentUser() guard: AuthenticatedUser, @Body() dto: CreateWalkInOfficeDto) {
    return this.visitors.createWalkInOffice(guard, dto);
  }

  @Post(':id/approve')
  @CheckAbility({ action: 'approve', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.visitors.approve(id, user);
  }

  @Post(':id/reject')
  @CheckAbility({ action: 'reject', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectVisitorDto,
  ) {
    return this.visitors.reject(id, user, dto.reason);
  }

  @Post(':id/regenerate-code')
  @CheckAbility({ action: 'update', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Regenerate short access code before check-in' })
  regenerateCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.visitors.regenerateAccessCode(id, user);
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

  @Post('verify/:pass')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @ApiOperation({ summary: 'Guard verifies a visitor pass (QR, access code, or visitor id)' })
  verify(@CurrentUser() guard: AuthenticatedUser, @Param('pass') pass: string) {
    return this.visitors.verifyByPass(pass, guard.activeCondoId ?? undefined);
  }

  @Post('check-in/:pass')
  @CheckAbility({ action: 'check-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'VisitorCheckIn' })
  checkIn(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('pass') pass: string,
    @Body() dto: CheckInVisitorDto,
  ) {
    return this.visitors.checkIn(pass, guard, dto);
  }

  @Post('check-out/:pass')
  @CheckAbility({ action: 'check-out', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'VisitorCheckIn' })
  checkOut(@CurrentUser() guard: AuthenticatedUser, @Param('pass') pass: string) {
    return this.visitors.checkOut(pass, guard);
  }
}
