import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UpdateWhatsAppConfigDto, WhatsAppTestSendDto } from './dto/whatsapp.dto';
import { WhatsAppConfigService } from './whatsapp-config.service';

@ApiTags('WhatsApp notifications')
@ApiBearerAuth('access')
@Controller('notifications')
export class WhatsAppConfigController {
  constructor(private readonly whatsapp: WhatsAppConfigService) {}

  @Get('condo/:condoId/whatsapp/config')
  @CheckAbility({ action: 'read', subject: 'Notification' })
  @ApiOperation({ summary: 'Get condo WhatsApp config (API key never returned)' })
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.whatsapp.getConfig(user, condoId);
  }

  @Put('condo/:condoId/whatsapp/config')
  @CheckAbility({ action: 'manage', subject: 'Notification' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'WhatsAppConfig',
    resourceIdFrom: 'params.condoId',
  })
  @ApiOperation({ summary: 'Update condo WhatsApp config (API key write-only)' })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateWhatsAppConfigDto,
  ) {
    return this.whatsapp.updateConfig(user, condoId, dto);
  }

  @Post('condo/:condoId/whatsapp/test')
  @CheckAbility({ action: 'manage', subject: 'Notification' })
  @ApiOperation({ summary: 'Send a test WhatsApp template message' })
  testSend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: WhatsAppTestSendDto,
  ) {
    return this.whatsapp.testSend(user, condoId, dto.phone);
  }
}
