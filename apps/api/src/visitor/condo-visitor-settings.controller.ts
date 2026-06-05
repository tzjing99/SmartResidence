import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UpdateVisitorSettingsDto } from './dto/visitor.dto';
import { VisitorService } from './visitor.service';

@ApiTags('Settings')
@ApiBearerAuth('access')
@Controller('settings/condo/:condoId/visitor')
export class CondoVisitorSettingsController {
  constructor(private readonly visitors: VisitorService) {}

  @Get()
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @ApiOperation({ summary: 'Get condo visitor policy settings' })
  getSettings(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.visitors.getVisitorSettings(condoId);
  }

  @Patch()
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update condo visitor policy settings' })
  updateSettings(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateVisitorSettingsDto,
  ) {
    return this.visitors.updateVisitorSettings(condoId, dto);
  }
}
