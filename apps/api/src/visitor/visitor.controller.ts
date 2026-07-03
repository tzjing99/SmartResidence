import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CheckInVisitorDto,
  CreateDeliveryPassDto,
  CreateFavouriteVisitorDto,
  CreateVisitorDto,
  CreateWalkInOfficeDto,
  CreateWalkInUnitDto,
  FlagPlateMismatchDto,
  GuardApproveWalkInDto,
  ListVisitorsQueryDto,
  RejectVisitorDto,
  SuspendOvernightDto,
  UpdateFavouriteVisitorDto,
  UpdateVisitorSettingsDto,
} from './dto/visitor.dto';
import { VisitorService } from './visitor.service';

@ApiTags('Visitors')
@ApiBearerAuth('access')
@Controller('visitors')
export class VisitorController {
  constructor(private readonly visitors: VisitorService) {}

  @Get('overnight-preview/:condoId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  @ApiOperation({ summary: 'Preview overnight rules, slots, and helper message for a date' })
  overnightPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('expectedAt') expectedAtRaw: string,
  ) {
    const expectedAt = new Date(expectedAtRaw);
    if (Number.isNaN(expectedAt.getTime())) {
      throw new BadRequestException('expectedAt query param must be a valid ISO date-time');
    }
    return this.visitors.overnightPreview(user, condoId, expectedAt);
  }

  @Get('admin/stats/:condoId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  @ApiOperation({ summary: 'Management visitor insight metrics for today' })
  adminVisitorStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.visitors.getAdminVisitorStats(user, condoId);
  }

  @Get('admin/overnight-summary/:condoId')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @ApiOperation({ summary: 'Monthly overnight usage summary per unit owner' })
  overnightOwnerSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query('month') month?: string,
  ) {
    return this.visitors.getOvernightOwnerSummary(user, condoId, month);
  }

  @Get('admin/visitor-settings/:condoId')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  visitorSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.visitors.getVisitorSettings(user, condoId);
  }

  @Patch('admin/visitor-settings/:condoId')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  updateVisitorSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateVisitorSettingsDto,
  ) {
    return this.visitors.updateVisitorSettings(user, condoId, dto);
  }

  @Patch('admin/overnight-policy/:unitId/suspend')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'UnitVisitorPolicy' })
  suspendOvernight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: SuspendOvernightDto,
  ) {
    return this.visitors.suspendUnitOvernight(condoId, unitId, user, dto);
  }

  @Patch('admin/overnight-policy/:unitId/unsuspend')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'UnitVisitorPolicy' })
  unsuspendOvernight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.visitors.unsuspendUnitOvernight(condoId, unitId, user);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Pre-register a visitor for one of my units' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVisitorDto) {
    return this.visitors.create(user, dto);
  }

  @Post('delivery-pass')
  @CheckAbility({ action: 'create', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({
    summary: 'Create a quick delivery or e-hailing pass (shorter validity, optional rider details)',
  })
  createDeliveryPass(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryPassDto) {
    return this.visitors.createDeliveryPass(user, dto);
  }

  @Get('guard/walk-in-policy')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @ApiOperation({ summary: 'Walk-in policy for the guard condo (approval toggle, timeout)' })
  guardWalkInPolicy(@CurrentUser() guard: AuthenticatedUser) {
    return this.visitors.getGuardWalkInPolicy(guard);
  }

  @Get('guard/live')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  @ApiOperation({
    summary: 'Guard live board — visitors currently checked in (privacy-scoped)',
  })
  guardLive(@CurrentUser() guard: AuthenticatedUser) {
    return this.visitors.listLiveForGuard(guard);
  }

  @Post('walk-in/unit')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Visitor', resourceIdFrom: 'response.id' })
  @ApiOperation({
    summary:
      'Guard registers a unit walk-in (owner approval or immediate check-in per condo policy)',
  })
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

  @Post(':id/guard-approve')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  @ApiOperation({
    summary:
      'Guard clears a pending unit walk-in at the gate (owner-by-phone or guard-manual) — goes straight to checked-in',
  })
  guardApproveWalkIn(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: GuardApproveWalkInDto,
  ) {
    return this.visitors.approveWalkInByGuard(id, guard, dto.method);
  }

  @Post(':id/acknowledge-walk-in')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'VisitorCheckIn',
    resourceIdFrom: 'response.id',
  })
  @ApiOperation({
    summary:
      'Guard records on-site entry for an owner-approved unit walk-in (no access pass / QR scan)',
  })
  acknowledgeWalkIn(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckInVisitorDto,
  ) {
    return this.visitors.acknowledgeWalkIn(id, guard, dto);
  }

  @Post(':id/approve-overnight')
  @CheckAbility({ action: 'approve-overnight', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Management approves an overnight pre-registration' })
  approveOvernight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.visitors.approveOvernight(id, user);
  }

  @Post(':id/flag-plate-mismatch')
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Visitor', resourceIdFrom: 'params.id' })
  flagPlateMismatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FlagPlateMismatchDto,
  ) {
    return this.visitors.flagPlateMismatch(id, user, dto);
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

  @Post(':id/check-out')
  @CheckAbility({ action: 'check-out', subject: 'Visitor' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'VisitorCheckIn',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Guard checks out a visitor by id (live board)' })
  checkOutById(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.visitors.checkOut(id, guard);
  }

  @Get('favourites/unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'FavouriteVisitor' })
  @ApiOperation({ summary: 'List saved visitor templates for a unit' })
  favouritesForUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.visitors.listFavourites(user, unitId);
  }

  @Post('favourites')
  @CheckAbility({ action: 'create', subject: 'FavouriteVisitor' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'FavouriteVisitor',
    resourceIdFrom: 'response.id',
  })
  createFavourite(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFavouriteVisitorDto) {
    return this.visitors.createFavourite(user, dto);
  }

  @Patch('favourites/:id')
  @CheckAbility({ action: 'update', subject: 'FavouriteVisitor' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'FavouriteVisitor',
    resourceIdFrom: 'params.id',
  })
  updateFavourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFavouriteVisitorDto,
  ) {
    return this.visitors.updateFavourite(id, user, dto);
  }

  @Delete('favourites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'FavouriteVisitor' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'FavouriteVisitor',
    resourceIdFrom: 'params.id',
  })
  deleteFavourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.visitors.deleteFavourite(id, user);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() query: ListVisitorsQueryDto,
  ) {
    const { view, status, ...page } = query;
    return this.visitors.listForUnit(user, unitId, { ...page, view, status });
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Visitor' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListVisitorsQueryDto,
  ) {
    const { view, status, filter, search, unitId, from, to, ...page } = query;
    return this.visitors.listForCondo(condoId, {
      ...page,
      status,
      view,
      filter,
      search,
      unitId,
      from,
      to,
      viewer: user,
    });
  }

  @Get(':id/walk-in-owner-contacts')
  @CheckAbility({ action: 'create-walk-in', subject: 'Visitor' })
  @ApiOperation({
    summary: 'Guard: owner phone contacts for a pending unit walk-in (fallback call)',
  })
  walkInOwnerContacts(
    @CurrentUser() guard: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.visitors.getWalkInOwnerContacts(id, guard);
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
