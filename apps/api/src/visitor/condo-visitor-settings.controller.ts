import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
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
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.visitors.getVisitorSettings(user, condoId);
  }

  @Patch()
  @CheckAbility({ action: 'manage-overnight-policy', subject: 'Visitor' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update condo visitor policy settings' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateVisitorSettingsDto,
  ) {
    return this.visitors.updateVisitorSettings(user, condoId, dto);
  }
}
