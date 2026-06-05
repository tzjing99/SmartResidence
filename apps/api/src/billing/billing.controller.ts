import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { PaginationDto } from '@/common/dto/pagination.dto';
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
import type { CreateInvoiceDto, CreatePaymentDto } from './dto/billing.dto';
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
