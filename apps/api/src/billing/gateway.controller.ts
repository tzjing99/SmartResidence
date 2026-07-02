import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { assertCondoManagement, assertCondoMember } from '@/common/authz/assert-condo-management';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { SetGatewayEnabledDto, UpsertGatewayDto } from './dto/gateway.dto';
import { GatewayConnectionService } from './gateway-connection.service';

@ApiTags('Payment gateways')
@ApiBearerAuth('access')
@Controller()
export class GatewayController {
  constructor(private readonly gateways: GatewayConnectionService) {}

  @Get('settings/condo/:condoId/billing/gateways')
  @CheckAbility({ action: 'read', subject: 'BillingSettings' })
  @ApiOperation({ summary: 'List payment gateway connections (secrets never returned)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.gateways.listForCondo(condoId);
  }

  @Put('settings/condo/:condoId/billing/gateways')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'PaymentGateway',
    resourceIdFrom: 'params.condoId',
  })
  @ApiOperation({ summary: 'Connect or update a payment gateway (credentials write-only)' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpsertGatewayDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.gateways.upsert(condoId, dto, user.id);
  }

  @Post('settings/condo/:condoId/billing/gateways/:id/enabled')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'PaymentGateway',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Enable or disable a payment gateway connection' })
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetGatewayEnabledDto,
  ) {
    assertCondoManagement(user, condoId);
    return this.gateways.setEnabled(condoId, id, dto.enabled);
  }

  @Delete('settings/condo/:condoId/billing/gateways/:id')
  @CheckAbility({ action: 'manage', subject: 'BillingSettings' })
  @Audit({
    action: AuditAction.DELETE,
    resourceType: 'PaymentGateway',
    resourceIdFrom: 'params.id',
  })
  @ApiOperation({ summary: 'Remove a payment gateway connection' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    assertCondoManagement(user, condoId);
    return this.gateways.remove(condoId, id);
  }

  @Get('billing/condo/:condoId/payment-methods')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  @ApiOperation({ summary: 'Enabled payment methods residents can pay with' })
  payableMethods(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    // Any member of the condo (not just management) needs this to pay invoices.
    assertCondoMember(user, condoId);
    return this.gateways.payableMethods(condoId);
  }
}
