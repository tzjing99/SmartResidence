import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import {
  CreateDefectElementDto,
  CreateDefectIssueDto,
  CreateDefectSpaceTypeDto,
  CreateUnitTypeDto,
  CreateUnitTypeSpaceDto,
  SetUnitTypeDto,
  UpdateDefectElementDto,
  UpdateDefectIssueDto,
  UpdateDefectSpaceTypeDto,
  UpdateUnitTypeDto,
  UpdateUnitTypeSpaceDto,
} from './dto/handover-config.dto';
import { HandoverConfigService } from './handover-config.service';

@ApiTags('Handover config')
@ApiBearerAuth('access')
@Controller()
export class HandoverConfigController {
  constructor(private readonly config: HandoverConfigService) {}

  // -- Unit types -----------------------------------------------------

  @Get('condos/:condoId/unit-types')
  @CheckAbility({ action: 'read', subject: 'UnitType' })
  @ApiOperation({ summary: 'List unit types (with room templates) for a condo' })
  listUnitTypes(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.config.listUnitTypes(condoId);
  }

  @Post('unit-types')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'UnitType', resourceIdFrom: 'response.id' })
  createUnitType(@Body() dto: CreateUnitTypeDto) {
    return this.config.createUnitType(dto);
  }

  @Patch('unit-types/:id')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  updateUnitType(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUnitTypeDto) {
    return this.config.updateUnitType(id, dto);
  }

  @Delete('unit-types/:id')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  deleteUnitType(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.config.deleteUnitType(id);
  }

  @Post('unit-types/:id/spaces')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  addSpace(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CreateUnitTypeSpaceDto) {
    return this.config.addSpace(id, dto);
  }

  @Patch('unit-type-spaces/:id')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  updateSpace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUnitTypeSpaceDto,
  ) {
    return this.config.updateSpace(id, dto);
  }

  @Delete('unit-type-spaces/:id')
  @CheckAbility({ action: 'manage', subject: 'UnitType' })
  deleteSpace(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.config.deleteSpace(id);
  }

  // -- Defect taxonomy ------------------------------------------------

  @Get('condos/:condoId/defect-taxonomy')
  @CheckAbility({ action: 'read', subject: 'DefectTaxonomy' })
  @ApiOperation({ summary: 'Defect taxonomy tree (space type -> element -> issue)' })
  getTaxonomy(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.config.getTaxonomy(condoId);
  }

  @Post('defect-space-types')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  createSpaceType(@Body() dto: CreateDefectSpaceTypeDto) {
    return this.config.createSpaceType(dto);
  }

  @Patch('defect-space-types/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  updateSpaceType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDefectSpaceTypeDto,
  ) {
    return this.config.updateSpaceType(id, dto);
  }

  @Delete('defect-space-types/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  deleteSpaceType(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.config.deleteSpaceType(id);
  }

  @Post('defect-elements')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  createElement(@Body() dto: CreateDefectElementDto) {
    return this.config.createElement(dto);
  }

  @Patch('defect-elements/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  updateElement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDefectElementDto,
  ) {
    return this.config.updateElement(id, dto);
  }

  @Delete('defect-elements/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  deleteElement(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.config.deleteElement(id);
  }

  @Post('defect-issues')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  createIssue(@Body() dto: CreateDefectIssueDto) {
    return this.config.createIssue(dto);
  }

  @Patch('defect-issues/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  updateIssue(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateDefectIssueDto) {
    return this.config.updateIssue(id, dto);
  }

  @Delete('defect-issues/:id')
  @CheckAbility({ action: 'manage', subject: 'DefectTaxonomy' })
  deleteIssue(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.config.deleteIssue(id);
  }

  // -- Unit type assignment + handover template -----------------------

  @Patch('condos/:condoId/units/:unitId')
  @CheckAbility({ action: 'manage', subject: 'Unit' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Unit', resourceIdFrom: 'params.unitId' })
  @ApiOperation({ summary: "Set a unit's unit type (first unit write endpoint)" })
  setUnitType(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Body() dto: SetUnitTypeDto,
  ) {
    return this.config.setUnitType(condoId, unitId, dto.unitTypeId);
  }

  @Get('units/:unitId/handover-template')
  @CheckAbility({ action: 'read', subject: 'Unit' })
  @ApiOperation({ summary: 'Rooms + taxonomy for the resident handover submission UI' })
  handoverTemplate(@Param('unitId', new ParseUUIDPipe()) unitId: string) {
    return this.config.handoverTemplate(unitId);
  }
}
