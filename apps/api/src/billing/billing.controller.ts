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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuditAction,
  AutomationJobKey,
  AutomationRunStatus,
  type InvoiceStatus,
  PaymentProvider,
} from '@prisma/client';
import type { Response } from 'express';
import { AutomationStatusService } from './automation-status.service';
import { BillingService } from './billing.service';
import {
  CreateAdvancePaymentDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  GenerateRecurringDto,
  RecordManualPaymentDto,
  RecordPrepaymentDto,
} from './dto/billing.dto';

@ApiTags('Billing')
@ApiBearerAuth('access')
@Controller('invoices')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly automations: AutomationStatusService,
  ) {}

  @Get('unit/:unitId')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  forUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() page: PaginationDto,
  ) {
    return this.billing.listForUnit(user, unitId, page);
  }

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  forCondo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() page: PaginationDto,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.billing.listForCondo(user, condoId, { ...page, status });
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Invoice' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.billing.getInvoice(id, user);
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
    return this.trackBillingGeneration(user, condoId, dto);
  }

  @Post('condo/:condoId/run-due-sweep')
  @CheckAbility({ action: 'manage', subject: 'Invoice' })
  @ApiOperation({ summary: 'Flag overdue invoices and emit upcoming-due reminders for a condo' })
  runDueSweep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.trackDueSweep(user, condoId);
  }

  @Post('prepayment')
  @CheckAbility({ action: 'manage', subject: 'Payment' })
  @Audit({ action: AuditAction.PAYMENT, resourceType: 'Prepayment' })
  @ApiOperation({ summary: 'Record an advance maintenance prepayment as a unit credit' })
  recordPrepayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordPrepaymentDto) {
    return this.billing.recordPrepayment(user, dto);
  }

  @Post('prepayment/intent')
  @CheckAbility({ action: 'pay', subject: 'Invoice' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'AdvancePayment' })
  @ApiOperation({ summary: 'Create a gateway intent for resident advance maintenance credit' })
  createAdvancePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdvancePaymentDto,
  ) {
    return this.billing.createAdvancePayment(user, dto);
  }

  @Get('payments/:paymentId/duitnow-status')
  @CheckAbility({ action: 'pay', subject: 'Invoice' })
  @ApiOperation({ summary: 'Poll DuitNow QR status for a pending invoice payment' })
  pollDuitNowInvoiceStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.billing.pollDuitNowQrStatus(user, paymentId, 'invoice');
  }

  @Get('advance-payments/:advancePaymentId/duitnow-status')
  @CheckAbility({ action: 'pay', subject: 'Invoice' })
  @ApiOperation({ summary: 'Poll DuitNow QR status for a pending advance payment' })
  pollDuitNowAdvanceStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('advancePaymentId', new ParseUUIDPipe()) advancePaymentId: string,
  ) {
    return this.billing.pollDuitNowQrStatus(user, advancePaymentId, 'advance');
  }

  private async trackBillingGeneration(
    user: AuthenticatedUser,
    condoId: string,
    dto: GenerateRecurringDto,
  ) {
    const run = await this.automations.startRun(user, {
      condoId,
      jobKey: AutomationJobKey.BILLING_GENERATION,
      stageName: 'Creating monthly invoices',
      summary: {
        trigger: 'manual_invoice_page',
        periodStart: new Date(dto.periodStart).toISOString(),
        periodEnd: new Date(dto.periodEnd).toISOString(),
        dueDate: new Date(dto.dueDate).toISOString(),
      },
    });
    try {
      const result = await this.billing.generateRecurring(user, condoId, dto, {
        metadata: { automationRunId: run.id, automationTrigger: 'manual_invoice_page' },
      });
      await this.automations.finishRun(
        run.id,
        result.created > 0 ? AutomationRunStatus.SUCCESS : AutomationRunStatus.SKIPPED,
        {
          trigger: 'manual_invoice_page',
          created: result.created,
          skipped: result.skipped,
          skippedNoRate: result.skippedNoRate,
          units: result.units,
        },
      );
      return result;
    } catch (err) {
      await this.automations.failRun(run.id, err);
      throw err;
    }
  }

  private async trackDueSweep(user: AuthenticatedUser, condoId: string) {
    const run = await this.automations.startRun(user, {
      condoId,
      jobKey: AutomationJobKey.DUE_SWEEP,
      stageName: 'Checking for overdue invoices',
      summary: { trigger: 'manual_invoice_page' },
    });
    try {
      const result = await this.billing.runDueSweep(user, condoId);
      await this.automations.finishRun(
        run.id,
        result.overdue > 0 || result.dueSoonNotified > 0
          ? AutomationRunStatus.SUCCESS
          : AutomationRunStatus.SKIPPED,
        {
          trigger: 'manual_invoice_page',
          overdue: result.overdue,
          dueSoonNotified: result.dueSoonNotified,
          sweptAt: result.sweptAt,
        },
      );
      return result;
    } catch (err) {
      await this.automations.failRun(run.id, err);
      throw err;
    }
  }
}

@ApiTags('Billing')
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Post('stripe')
  async stripeWebhook(
    @RawBody() body: Buffer,
    @Headers() headers: Record<string, string | string[]>,
  ) {
    return this.billing.handleStripeCallback(body, headers);
  }

  @Public()
  @Post('fpx')
  async fpxWebhook() {
    // Bare FPX is intentionally not self-settling. Real FPX is handled through
    // signed Fiuu / iPay88 callbacks so public callers cannot forge a payment.
    return { received: true, ignored: true };
  }

  @Public()
  @Post('fiuu')
  async fiuuWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[]>,
  ) {
    return this.billing.handleGatewayCallback(PaymentProvider.RAZER, body, headers);
  }

  /** Browser return from Fiuu hosted page (POST). Settles then redirects the resident. */
  @Public()
  @Post('fiuu/return')
  async fiuuReturn(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[]>,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ) {
    await this.billing.handleGatewayCallback(PaymentProvider.RAZER, body, headers);
    res.redirect(302, this.gatewayReturnTarget(next));
  }

  /** Browser return from iPay88 hosted page (POST). Settles then redirects the resident. */
  @Public()
  @Post('ipay88/return')
  async ipay88Return(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[]>,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ) {
    await this.billing.handleGatewayCallback(PaymentProvider.IPAY88, body, headers);
    res.redirect(302, this.gatewayReturnTarget(next));
  }

  @Public()
  @Post('ipay88')
  async ipay88Webhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[]>,
  ) {
    return this.billing.handleGatewayCallback(PaymentProvider.IPAY88, body, headers);
  }

  @Public()
  @Post('duitnow-qr')
  @ApiOperation({ summary: 'DuitNow QR payment notification (server-to-server)' })
  async duitnowQrWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[]>,
  ) {
    return this.billing.handleGatewayCallback(PaymentProvider.DUITNOW_QR, body, headers);
  }

  /**
   * Sandbox seam: simulate DuitNow QR settlement in TEST when no webhook secret is
   * configured (same pattern as MyInvois sandbox — no real PayNet call).
   */
  @Public()
  @Post('duitnow-qr/sandbox/settle')
  @ApiOperation({ summary: '[SANDBOX] Simulate DuitNow QR payment success' })
  async duitnowSandboxSettle(@Body() body: Record<string, unknown>) {
    return this.billing.handleGatewayCallback(
      PaymentProvider.DUITNOW_QR,
      {
        ...body,
        status: body.status ?? 'SUCCESS',
        sandbox: true,
      },
      {},
    );
  }

  /** Accept http(s) app URLs and mobile deep links after hosted gateway return. */
  private gatewayReturnTarget(next: string | undefined): string {
    const fallback = 'http://localhost:3000/billing';
    if (!next) return fallback;
    if (next.startsWith('http') || next.startsWith('smartresidence://')) return next;
    return fallback;
  }
}
