import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { assertCondoManagement } from '@/common/authz/assert-condo-management';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { BillingAutomationService } from './billing-automation.service';
import { BillingSettingsService } from './billing-settings.service';
import {
  RunBillingAutomationDto,
  UpdateBillingAutomationDto,
  UpdateReceiptTemplateDto,
} from './dto/billing-settings.dto';
import {
  AddFeeSchedulePresetsDto,
  UpsertFeeRateDto,
  UpsertFeeScheduleExtraLineDto,
} from './dto/fee-schedule.dto';
import { FeeScheduleService } from './fee-schedule.service';

@ApiTags('Billing settings')
@ApiBearerAuth('access')
@Controller('settings/condo/:condoId/billing')
export class BillingSettingsController {
  constructor(
    private readonly settings: BillingSettingsService,
    private readonly feeSchedule: FeeScheduleService,
    private readonly automation: BillingAutomationService,
  ) {}

  @Get('receipt-template')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Get the condo receipt template config' })
  getReceiptTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.settings.getReceiptTemplate(condoId);
  }

  @Patch('receipt-template')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update the condo receipt template config' })
  updateReceiptTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateReceiptTemplateDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.settings.updateReceiptTemplate(condoId, dto);
  }

  @Get('automation')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Get automatic billing cycle settings' })
  getAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.settings.getBillingAutomation(condoId);
  }

  @Patch('automation')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update automatic billing cycle settings' })
  updateAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateBillingAutomationDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.settings.updateBillingAutomation(condoId, dto);
  }

  @Get('automation/preview')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Preview the next automatic billing cycle run' })
  previewAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.automation.previewCondo(condoId);
  }

  @Post('automation/run')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Safely run automatic billing cycle generation now' })
  runAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: RunBillingAutomationDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.automation.runCondo(user, condoId, { dryRun: dto?.dryRun, trigger: 'manual_run' });
  }

  @Get('fee-rates')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List unit types with their monthly fee rates' })
  listFeeRates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.listForCondo(condoId);
  }

  @Put('fee-rates')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Create or update a unit type fee rate' })
  upsertFeeRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertFeeRateDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.upsert(condoId, dto);
  }

  @Delete('fee-rates/:unitTypeId')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Remove a unit type fee rate' })
  removeFeeRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitTypeId', new ParseUUIDPipe()) unitTypeId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.remove(condoId, unitTypeId);
  }

  @Get('fee-extra-lines')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List dynamic monthly fee schedule lines' })
  listFeeExtraLines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.listExtraLines(condoId);
  }

  @Put('fee-extra-lines')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Create or update a dynamic monthly fee schedule line' })
  upsertFeeExtraLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertFeeScheduleExtraLineDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.upsertExtraLine(condoId, dto);
  }

  @Post('fee-extra-lines/presets')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Add common real-life fee schedule presets in one click' })
  addFeeExtraLinePresets(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: AddFeeSchedulePresetsDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.addPresetExtraLines(condoId, dto);
  }

  @Delete('fee-extra-lines/:id')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Remove a dynamic monthly fee schedule line' })
  removeFeeExtraLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.feeSchedule.removeExtraLine(condoId, id);
  }
}
