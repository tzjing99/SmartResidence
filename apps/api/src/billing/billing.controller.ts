import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBody,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, type InvoiceStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  CreatePaymentDto,
  GenerateRecurringDto,
  RecordManualPaymentDto,
} from './dto/billing.dto';
import { StripeAdapter } from './providers/stripe.adapter';

@ApiTags('Billing')
@ApiBearerAuth('access')
@Controller('invoices')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeAdapter,
  ) {}

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  forUnit(@Param('unitId', new ParseUUIDPipe()) unitId: string, @Query() page: PaginationDto) {
    return this.billing.listForUnit(unitId, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  forCondo(
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() page: PaginationDto,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.billing.listForCondo(condoId, { ...page, status });
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.billing.getInvoice(id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'Invoice' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Invoice', resourceIdFrom: 'response.id' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.billing.create(user, dto);
  }

  @Post(':id/payments')
  @CheckAbility({ action: 'pay', subject: 'Invoice' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'Payment' })
  @ApiOperation({ summary: 'Create a payment intent on the chosen provider' })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.billing.createPayment(user, id, dto);
  }

  @Post(':id/manual-payment')
  @CheckAbility({ action: 'manage', subject: 'Payment' })
  @Audit({ action: AuditAction.PAYMENT, resourceType: 'Payment', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Record an off-gateway (cash/transfer) settlement against an invoice' })
  recordManualPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordManualPaymentDto,
  ) {
    return this.billing.recordManualPayment(user, id, dto);
  }

  @Post(':id/void')
  @CheckAbility({ action: 'manage', subject: 'Invoice' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Invoice', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Void an invoice (cannot void a fully paid one)' })
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.billing.voidInvoice(user, id, body?.reason);
  }

  @Post('condo/:condoId/generate-recurring')
  @CheckAbility({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Generate a maintenance-fee invoice per unit for a billing period' })
  generateRecurring(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Body() dto: GenerateRecurringDto,
  ) {
    return this.billing.generateRecurring(user, condoId, dto);
  }

  @Post('condo/:condoId/run-due-sweep')
  @CheckAbility({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Flag overdue invoices and emit upcoming-due reminders for a condo' })
  runDueSweep(@Param('condoId', new ParseUUIDPipe()) condoId: string) {
    return this.billing.runDueSweep(condoId);
  }
}

@ApiTags('Billing')
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeAdapter,
  ) {}

  @Public()
  @Post('stripe')
  async stripeWebhook(
    @RawBody() body: Buffer,
    @Headers() headers: Record<string, string | string[]>,
  ) {
    const verified = await this.stripe.verifyWebhook({ payload: body, headers });
    if (verified?.succeeded) {
      await this.billing.markPaymentSucceeded(verified.providerRef);
    }
    return { received: true };
  }

  @Public()
  @Post('fpx')
  async fpxWebhook(@Body() body: { providerRef?: string; status?: string }) {
    if (body.status === 'success' && body.providerRef) {
      await this.billing.markPaymentSucceeded(body.providerRef);
    }
    return { received: true };
  }
}
