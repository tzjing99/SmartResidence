import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
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
  getReceiptTemplate(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.settings.getReceiptTemplate(condoId);
  }

  @Patch('receipt-template')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update the condo receipt template config' })
  updateReceiptTemplate(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateReceiptTemplateDto,
  ) {
    return this.settings.updateReceiptTemplate(condoId, dto);
  }

  @Get('automation')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Get automatic billing cycle settings' })
  getAutomation(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.settings.getBillingAutomation(condoId);
  }

  @Patch('automation')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update automatic billing cycle settings' })
  updateAutomation(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateBillingAutomationDto,
  ) {
    return this.settings.updateBillingAutomation(condoId, dto);
  }

  @Get('automation/preview')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'Preview the next automatic billing cycle run' })
  previewAutomation(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
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
    return this.automation.runCondo(user, condoId, { dryRun: dto?.dryRun, trigger: 'manual_run' });
  }

  @Get('fee-rates')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List unit types with their monthly fee rates' })
  listFeeRates(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.feeSchedule.listForCondo(condoId);
  }

  @Put('fee-rates')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Create or update a unit type fee rate' })
  upsertFeeRate(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertFeeRateDto,
  ) {
    return this.feeSchedule.upsert(condoId, dto);
  }

  @Delete('fee-rates/:unitTypeId')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Remove a unit type fee rate' })
  removeFeeRate(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitTypeId', new ParseUUIDPipe()) unitTypeId: string,
  ) {
    return this.feeSchedule.remove(condoId, unitTypeId);
  }

  @Get('fee-extra-lines')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List dynamic monthly fee schedule lines' })
  listFeeExtraLines(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.feeSchedule.listExtraLines(condoId);
  }

  @Put('fee-extra-lines')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Create or update a dynamic monthly fee schedule line' })
  upsertFeeExtraLine(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertFeeScheduleExtraLineDto,
  ) {
    return this.feeSchedule.upsertExtraLine(condoId, dto);
  }

  @Post('fee-extra-lines/presets')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Add common real-life fee schedule presets in one click' })
  addFeeExtraLinePresets(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: AddFeeSchedulePresetsDto,
  ) {
    return this.feeSchedule.addPresetExtraLines(condoId, dto);
  }

  @Delete('fee-extra-lines/:id')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({ action: AuditAction.DELETE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Remove a dynamic monthly fee schedule line' })
  removeFeeExtraLine(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.feeSchedule.removeExtraLine(condoId, id);
  }
}
