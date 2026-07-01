import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutomationStatusService } from './automation-status.service';

@ApiTags('Automations')
@ApiBearerAuth('access')
@Controller('automations')
export class AutomationStatusController {
  constructor(private readonly automations: AutomationStatusService) {}

  @Get('condo/:condoId/status')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List admin automation pipeline status and recent runs' })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.automations.listStatus(user, condoId);
  }
}
