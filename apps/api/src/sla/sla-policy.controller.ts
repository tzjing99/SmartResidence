import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SlaAuditQueryDto,
  UpdateAutoAssignmentDto,
  UpdateMlPriorityDto,
  UpdateSlaPoliciesDto,
} from './dto/sla.dto';
import { SlaPolicyService } from './sla-policy.service';

@ApiTags('SLA')
@ApiBearerAuth('access')
@Controller('sla')
export class SlaPolicyController {
  constructor(private readonly slaPolicy: SlaPolicyService) {}

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'SlaPolicy' })
  @ApiOperation({ summary: 'Get SLA policies, advisory bands, and grace period' })
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.slaPolicy.getSettings(user, condoId);
  }

  @Put('condo/:condoId')
  @CheckAbility({ action: 'update', subject: 'SlaPolicy' })
  @ApiOperation({ summary: 'Update SLA policies (management admin only)' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateSlaPoliciesDto,
  ) {
    return this.slaPolicy.updateSettings(user, condoId, dto);
  }

  @Put('condo/:condoId/ml-priority')
  @CheckAbility({ action: 'update', subject: 'SlaPolicy' })
  @ApiOperation({ summary: 'Enable/disable ML priority suggestions (C6)' })
  updateMlPriority(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateMlPriorityDto,
  ) {
    return this.slaPolicy.updateMlPriority(user, condoId, dto);
  }

  @Put('condo/:condoId/auto-assignment')
  @CheckAbility({ action: 'update', subject: 'SlaPolicy' })
  @ApiOperation({ summary: 'Update assignee pools for auto-assignment (S1/M2)' })
  updateAutoAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateAutoAssignmentDto,
  ) {
    return this.slaPolicy.updateAutoAssignment(user, condoId, dto);
  }

  @Get('condo/:condoId/audit')
  @CheckAbility({ action: 'read', subject: 'SlaPolicy' })
  @ApiOperation({ summary: 'SLA settings change audit log (management + unit owners)' })
  listAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: SlaAuditQueryDto,
  ) {
    return this.slaPolicy.listAudit(user, condoId, query);
  }
}
