import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CancelEInvoiceDto, UpdateEInvoiceConfigDto } from './dto/einvoice.dto';
import { EInvoiceService } from './einvoice.service';

@ApiTags('E-invoice (LHDN MyInvois)')
@ApiBearerAuth('access')
@Controller('einvoice')
export class EInvoiceController {
  constructor(private readonly einvoice: EInvoiceService) {}

  @Get('condo/:condoId/config')
  @CheckAbility({ action: 'read', subject: 'EInvoice' })
  @ApiOperation({ summary: 'Get the condo LHDN MyInvois config (API secret never returned)' })
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.einvoice.getConfig(user, condoId);
  }

  @Put('condo/:condoId/config')
  @CheckAbility({ action: 'manage', subject: 'EInvoice' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'EInvoice', resourceIdFrom: 'params.condoId' })
  @ApiOperation({ summary: 'Update the condo LHDN MyInvois config (API secret write-only)' })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: UpdateEInvoiceConfigDto,
  ) {
    return this.einvoice.updateConfig(user, condoId, dto);
  }

  @Get('invoice/:invoiceId')
  @CheckAbility({ action: 'read', subject: 'EInvoice' })
  @ApiOperation({ summary: 'Get the e-invoice status for an invoice' })
  getForInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.einvoice.getForInvoice(user, invoiceId);
  }

  @Post('invoice/:invoiceId/submit')
  @CheckAbility({ action: 'manage', subject: 'EInvoice' })
  @Audit({
    action: AuditAction.CREATE,
    resourceType: 'EInvoice',
    resourceIdFrom: 'params.invoiceId',
  })
  @ApiOperation({ summary: 'Build and submit an invoice to LHDN MyInvois' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.einvoice.submit(user, invoiceId);
  }

  @Post('invoice/:invoiceId/cancel')
  @CheckAbility({ action: 'manage', subject: 'EInvoice' })
  @Audit({
    action: AuditAction.UPDATE,
    resourceType: 'EInvoice',
    resourceIdFrom: 'params.invoiceId',
  })
  @ApiOperation({ summary: 'Cancel a submitted LHDN MyInvois e-invoice' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Body() dto: CancelEInvoiceDto,
  ) {
    return this.einvoice.cancel(user, invoiceId, dto?.reason);
  }
}
