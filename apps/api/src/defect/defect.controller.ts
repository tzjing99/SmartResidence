import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, DefectStatus } from '@prisma/client';
import { DefectService } from './defect.service';
import { AddDefectUpdateDto, CreateDefectDto, TransitionDefectDto } from './dto/defect.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';

@ApiTags('Defects')
@ApiBearerAuth('access')
@Controller('defects')
export class DefectController {
  constructor(private readonly defects: DefectService) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'Defect' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Defect', resourceIdFrom: 'response.id' })
  @ApiOperation({ summary: 'Submit a new defect / maintenance ticket' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDefectDto) {
    return this.defects.create(user, dto);
  }

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Defect' })
  forUnit(@Param('unitId', new ParseUUIDPipe()) unitId: string, @Query() page: PaginationDto) {
    return this.defects.listForUnit(unitId, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Defect' })
  forCondo(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() page: PaginationDto,
    @Query('status') status?: DefectStatus,
  ) {
    return this.defects.listForCondo(condoId, { ...page, status });
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Defect' })
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.defects.getOne(id);
  }

  @Patch(':id/status')
  @CheckAbility({ action: 'update', subject: 'Defect' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Defect', resourceIdFrom: 'params.id' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionDefectDto,
  ) {
    return this.defects.transition(id, user, dto);
  }

  @Post(':id/updates')
  @CheckAbility({ action: 'update', subject: 'Defect' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'DefectUpdate' })
  addUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddDefectUpdateDto,
  ) {
    return this.defects.addUpdate(id, user, dto);
  }
}
