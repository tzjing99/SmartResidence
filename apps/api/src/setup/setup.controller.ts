import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UpdateSetupStepDto } from './dto/setup.dto';
import { SetupService } from './setup.service';

@ApiTags('Setup')
@ApiBearerAuth('access')
@Controller('setup/condo/:condoId')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Condo' })
  @ApiOperation({ summary: 'Get first-time setup status and derived checklist' })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.setup.getStatus(user, condoId);
  }

  @Patch()
  @CheckAbility({ action: 'manage', subject: 'Condo' })
  @ApiOperation({ summary: 'Mark a setup step as done or skipped' })
  updateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateSetupStepDto,
  ) {
    return this.setup.updateStep(user, condoId, dto);
  }

  @Post('complete')
  @CheckAbility({ action: 'manage', subject: 'Condo' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Mark the building as configured (idempotent)' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.setup.complete(user, condoId);
  }

  @Post('dismiss')
  @CheckAbility({ action: 'manage', subject: 'Condo' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Condo', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Defer the setup wizard (stops forced redirect until completed)' })
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.setup.dismiss(user, condoId);
  }
}
