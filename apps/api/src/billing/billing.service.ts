import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RoleId,
} from '@prisma/client';
import { formatCompactUnitLabel } from '@smartresidence/shared-types';
import type {
  CreateAdvancePaymentDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  GenerateRecurringDto,
  RecordManualPaymentDto,
  RecordPrepaymentDto,
} from './dto/billing.dto';
import { FeeScheduleService } from './fee-schedule.service';
import { GatewayConnectionService } from './gateway-connection.service';
import { LedgerService } from './ledger.service';
import { DuitNowAdapter, duitnowBillRef } from './providers/duitnow.adapter';
import { FiuuAdapter } from './providers/fiuu.adapter';
import { FpxAdapter } from './providers/fpx.adapter';
import { IPay88Adapter } from './providers/ipay88.adapter';
import type { PaymentProviderAdapter } from './providers/payment-provider.interface';
import { StripeAdapter } from './providers/stripe.adapter';
import { ReceiptService } from './receipt.service';

/** Invoices this many days from their due date are flagged "due soon" in the sweep. */
const DUE_SOON_WINDOW_DAYS = 5;

type JsonObject = Record<string, unknown>;

const asJsonObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {};

interface GenerateRecurringOptions {
  skipAuthorization?: boolean;
  metadata?: JsonObject;
  triggeredByUserId?: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly providers: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly feeSchedule: FeeScheduleService,
    private readonly ledger: LedgerService,
    private readonly receipts: ReceiptService,
    private readonly gateways: GatewayConnectionService,
    stripe: StripeAdapter,
    fpx: FpxAdapter,
    fiuu: FiuuAdapter,
    ipay88: IPay88Adapter,
    duitnow: DuitNowAdapter,
  ) {
    this.providers = new Map<PaymentProvider, PaymentProviderAdapter>([
      [PaymentProvider.STRIPE, stripe],
      [PaymentProvider.FPX, fpx],
      [PaymentProvider.RAZER, fiuu],
      [PaymentProvider.IPAY88, ipay88],
      [PaymentProvider.DUITNOW_QR, duitnow],
    ]);
  }

  async listForUnit(
    actor: AuthenticatedUser,
    unitId: string,
    opts: { limit: number; offset: number },
  ) {
    await this.assertCanReadUnitMoney(actor, unitId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: { unitId },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { dueDate: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.invoice.count({ where: { unitId } }),
    ]);
    return { items, total, ...opts };
  }

  async listForCondo(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number; status?: InvoiceStatus },
  ) {
    this.assertCondoManagement(actor, condoId, false);
    const where = { condoId, ...(opts.status ? { status: opts.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { unit: true, payments: { orderBy: { createdAt: 'desc' } } },
        orderBy: { dueDate: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getInvoice(id: string, actor?: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        unit: true,
        condo: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (actor) this.assertCanReadInvoice(actor, invoice);
    return invoice;
  }

  async create(actor: AuthenticatedUser, dto: CreateInvoiceDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    this.assertCondoManagement(actor, unit.condoId, true);

    const subtotal = dto.lines.reduce(
      (sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1),
      0,
    );
    const total = subtotal;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextInvoiceNumber(tx, unit.condoId);
      const created = await tx.invoice.create({
        data: {
          condoId: unit.condoId,
          unitId: unit.id,
          number,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          dueDate: dto.dueDate,
          status: InvoiceStatus.ISSUED,
          issuedAt: new Date(),
          subtotal,
          total,
          currencyCode: 'MYR',
          lines: {
            create: dto.lines.map((l, i) => ({
              code: l.code,
              description: l.description,
              formula: l.formula,
              quantity: l.quantity ?? 1,
              unitPrice: l.unitPrice,
              amount: Number(l.unitPrice) * Number(l.quantity ?? 1),
              sortOrder: i,
            })),
          },
          metadata: { issuedByUserId: actor.id },
        },
        include: { lines: true },
      });
      await this.ledger.recordInvoiceCharges(
        tx,
        {
          id: created.id,
          condoId: created.condoId,
          unitId: created.unitId,
          issuedAt: created.issuedAt,
        },
        created.lines.map((l) => ({
          code: l.code,
          amount: Number(l.amount),
          description: l.description,
        })),
        actor.id,
      );
      return created;
    });
    await this.applyCreditToInvoice(invoice.id, invoice.unitId, invoice.condoId);

    this.events.emit('invoice.issued', { invoiceId: invoice.id });
    return invoice;
  }

  /**
   * Issue an invoice inside a caller-supplied transaction so it stays atomic
   * with the domain action that triggered it (e.g. confirming a facility
   * booking). Reuses the shared invoice numbering + ledger charge helpers.
   * The caller is responsible for authorization and for emitting
   * `invoice.issued` after the transaction commits.
   */
  async createInvoiceInTx(
    tx: Prisma.TransactionClient,
    opts: {
      condoId: string;
      unitId: string;
      dueDate: Date;
      periodStart?: Date;
      periodEnd?: Date;
      lines: Array<{ code: string; description: string; unitPrice: number; quantity?: number }>;
      actorUserId?: string | null;
      metadata?: JsonObject;
    },
  ) {
    const subtotal = opts.lines.reduce(
      (sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1),
      0,
    );
    const number = await this.nextInvoiceNumber(tx, opts.condoId);
    const created = await tx.invoice.create({
      data: {
        condoId: opts.condoId,
        unitId: opts.unitId,
        number,
        periodStart: opts.periodStart ?? new Date(),
        periodEnd: opts.periodEnd ?? opts.dueDate,
        dueDate: opts.dueDate,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
        subtotal,
        total: subtotal,
        currencyCode: 'MYR',
        lines: {
          create: opts.lines.map((l, i) => ({
            code: l.code,
            description: l.description,
            quantity: l.quantity ?? 1,
            unitPrice: l.unitPrice,
            amount: Number(l.unitPrice) * Number(l.quantity ?? 1),
            sortOrder: i,
          })),
        },
        metadata: { ...(opts.metadata ?? {}), issuedByUserId: opts.actorUserId ?? null },
      },
      include: { lines: true },
    });
    await this.ledger.recordInvoiceCharges(
      tx,
      {
        id: created.id,
        condoId: created.condoId,
        unitId: created.unitId,
        issuedAt: created.issuedAt,
      },
      created.lines.map((l) => ({
        code: l.code,
        amount: Number(l.amount),
        description: l.description,
      })),
      opts.actorUserId ?? null,
    );
    return created;
  }

  /**
   * Void an unpaid invoice inside a caller-supplied transaction, reversing its
   * ledger charges. Returns true when voided, false when it was skipped
   * (already paid/partly paid — the caller should leave settlement to
   * management). Used when a facility booking with a fee invoice is cancelled.
   */
  async voidUnpaidInvoiceInTx(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    actorUserId?: string | null,
    reason?: string | null,
  ): Promise<boolean> {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return false;
    if (invoice.status === InvoiceStatus.VOID) return true;
    if (Number(invoice.amountPaid) > 0.005 || invoice.status === InvoiceStatus.PAID) return false;
    await this.ledger.reverseInvoiceCharges(
      tx,
      { id: invoice.id, condoId: invoice.condoId, unitId: invoice.unitId, number: invoice.number },
      actorUserId ?? null,
      reason ?? null,
    );
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID, voidedAt: new Date() },
    });
    return true;
  }

  async createPayment(actor: AuthenticatedUser, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.getInvoice(invoiceId, actor);
    this.assertCanPayInvoice(actor, invoice);
    if (invoice.status === InvoiceStatus.VOID)
      throw new BadRequestException('Cannot pay a voided invoice');
    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Invoice already paid');
    const adapter = this.providers.get(dto.provider);
    if (!adapter) throw new BadRequestException(`Unsupported provider: ${dto.provider}`);

    // Only allow online payment through a gateway the condo has actually enabled
    // and configured. This keeps the API consistent with the resident method
    // picker and prevents phantom PENDING payments / dev mock redirects from
    // being created in production.
    const resolved = await this.gateways.resolveCredentials(invoice.condoId, dto.provider);
    if (!resolved) {
      throw new BadRequestException(
        'This payment method is not enabled for your condo. Please contact management.',
      );
    }

    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    if (outstanding <= 0.005) throw new BadRequestException('Nothing left to pay on this invoice');

    await this.cancelStalePendingPayments(invoice.id, dto.provider);

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        userId: actor.id,
        amount: outstanding,
        currencyCode: invoice.currencyCode,
        status: PaymentStatus.PENDING,
        provider: dto.provider,
      },
    });

    const intent = await adapter.createIntent({
      invoice,
      payment,
      returnUrl: dto.returnUrl,
      credentials: resolved?.credentials,
      publicConfig: resolved?.publicConfig,
      mode: resolved?.mode,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: intent.providerRef },
    });

    return { paymentId: payment.id, ...intent };
  }

  async createAdvancePayment(actor: AuthenticatedUser, dto: CreateAdvancePaymentDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { condo: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    this.assertCanPayUnit(actor, unit.condoId, unit.id);
    if (dto.amount <= 0) throw new BadRequestException('Amount must be greater than zero');

    const adapter = this.providers.get(dto.provider);
    if (!adapter) throw new BadRequestException(`Unsupported provider: ${dto.provider}`);
    const resolved = await this.gateways.resolveCredentials(unit.condoId, dto.provider);
    if (!resolved) {
      throw new BadRequestException(
        'This payment method is not enabled for your condo. Please contact management.',
      );
    }

    await this.prisma.advancePayment.updateMany({
      where: {
        unitId: unit.id,
        userId: actor.id,
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.CANCELLED },
    });

    const advance = await this.prisma.advancePayment.create({
      data: {
        condoId: unit.condoId,
        unitId: unit.id,
        userId: actor.id,
        amount: dto.amount,
        currencyCode: unit.condo.currencyCode ?? 'MYR',
        status: PaymentStatus.PENDING,
        provider: dto.provider,
        metadata: { purpose: 'ADVANCE_MAINTENANCE' },
      },
    });

    const intent = await adapter.createIntent({
      invoice: this.advancePaymentInvoiceView(
        unit.condoId,
        unit.id,
        unit.condo.currencyCode,
        advance,
      ),
      payment: advance as never,
      returnUrl: dto.returnUrl,
      credentials: resolved.credentials,
      publicConfig: resolved.publicConfig,
      mode: resolved.mode,
    });

    await this.prisma.advancePayment.update({
      where: { id: advance.id },
      data: { providerRef: intent.providerRef },
    });

    return { advancePaymentId: advance.id, ...intent };
  }

  private advancePaymentInvoiceView(
    condoId: string,
    unitId: string,
    currencyCode: string,
    advance: { id: string; amount: Prisma.Decimal | number; createdAt: Date },
  ) {
    const now = advance.createdAt ?? new Date();
    return {
      id: advance.id,
      condoId,
      unitId,
      number: `ADV-${advance.id.slice(0, 8).toUpperCase()}`,
      periodStart: now,
      periodEnd: now,
      dueDate: now,
      status: InvoiceStatus.ISSUED,
      subtotal: advance.amount,
      tax: 0,
      discount: 0,
      total: advance.amount,
      amountPaid: 0,
      currencyCode: currencyCode ?? 'MYR',
      issuedAt: now,
      paidAt: null,
      voidedAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    } as never;
  }

  /** Resolve a gateway payment by provider reference (Fiuu/iPay88 order id, DuitNow bill ref, etc.). */
  private async findPaymentByProviderRef(ref: string) {
    const include = { invoice: true } as const;
    const direct = await this.prisma.payment.findFirst({ where: { providerRef: ref }, include });
    if (direct) return direct;
    if (/^[a-f0-9]{30}$/i.test(ref)) {
      const pending = await this.prisma.payment.findMany({
        where: { provider: PaymentProvider.DUITNOW_QR, status: PaymentStatus.PENDING },
        include,
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      const match = pending.find((p) => duitnowBillRef(p.id) === ref);
      if (match) return match;
    }
    if (/^[a-f0-9]{32}$/i.test(ref)) {
      const uuid = `${ref.slice(0, 8)}-${ref.slice(8, 12)}-${ref.slice(12, 16)}-${ref.slice(16, 20)}-${ref.slice(20)}`;
      return this.prisma.payment.findFirst({
        where: { OR: [{ providerRef: uuid }, { id: uuid }] },
        include,
      });
    }
    return null;
  }

  private async findAdvancePaymentByProviderRef(ref: string) {
    const direct = await this.prisma.advancePayment.findFirst({ where: { providerRef: ref } });
    if (direct) return direct;
    if (/^[a-f0-9]{30}$/i.test(ref)) {
      const pending = await this.prisma.advancePayment.findMany({
        where: { provider: PaymentProvider.DUITNOW_QR, status: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      const match = pending.find((p) => duitnowBillRef(p.id) === ref);
      if (match) return match;
    }
    if (/^[a-f0-9]{32}$/i.test(ref)) {
      const uuid = `${ref.slice(0, 8)}-${ref.slice(8, 12)}-${ref.slice(12, 16)}-${ref.slice(16, 20)}-${ref.slice(20)}`;
      return this.prisma.advancePayment.findFirst({
        where: { OR: [{ providerRef: uuid }, { id: uuid }] },
      });
    }
    return null;
  }

  /** Supersede abandoned gateway attempts so residents can switch payment methods. */
  private async cancelStalePendingPayments(invoiceId: string, _provider?: PaymentProvider) {
    await this.prisma.payment.updateMany({
      where: { invoiceId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  /**
   * Handle a Fiuu / iPay88 server-to-server callback (or browser return). The
   * payment is located by its provider reference, the condo's credentials are
   * resolved, and the adapter verifies the signature before we settle.
   */
  async handleGatewayCallback(
    provider: PaymentProvider,
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const ref = String(
      body.orderid ?? body.RefNo ?? body.refNo ?? body.billRef ?? body.endToEndId ?? '',
    );
    if (!ref) return { received: true };
    const payment = await this.findPaymentByProviderRef(ref);
    const advancePayment = payment ? null : await this.findAdvancePaymentByProviderRef(ref);
    if (!payment && !advancePayment) return { received: true };
    const adapter = this.providers.get(provider);
    if (!adapter) return { received: true };
    const condoId = payment?.invoice.condoId ?? advancePayment?.condoId;
    if (!condoId) return { received: true };
    const resolved = await this.gateways.resolveCredentials(condoId, provider);
    const verified = await adapter.verifyWebhook({
      payload: '',
      headers,
      body,
      credentials: resolved?.credentials,
    });
    if (!verified) return { received: true };

    if (!verified.succeeded) {
      if (payment) {
        await this.markPaymentFailed(verified.providerRef, String(body.status ?? ''));
      } else {
        await this.markAdvancePaymentFailed(verified.providerRef, String(body.status ?? ''));
      }
      return { received: true };
    }

    // Defense in depth: only settle when the gateway-reported amount matches the
    // pending payment. The signature already covers `amount`, but this guards
    // against a correctly-signed partial/altered amount settling the full invoice.
    const reportedAmount = Number(body.amount ?? body.Amount ?? Number.NaN);
    const expected = Number(payment?.amount ?? advancePayment?.amount ?? 0);
    if (Number.isFinite(reportedAmount) && Math.abs(reportedAmount - expected) > 0.01) {
      this.logger.warn(
        `Gateway amount mismatch for ${verified.providerRef}: reported ${reportedAmount}, expected ${expected}. Holding for review.`,
      );
      if (payment) {
        await this.flagPaymentForReview(verified.providerRef, reportedAmount, expected);
      } else {
        await this.flagAdvancePaymentForReview(verified.providerRef, reportedAmount, expected);
      }
      return { received: true };
    }

    if (payment) {
      await this.markPaymentSucceeded(verified.providerRef);
    } else {
      await this.markAdvancePaymentSucceeded(verified.providerRef);
    }
    return { received: true };
  }

  /**
   * Poll DuitNow QR inquiry API (when configured) and settle pending invoice or
   * advance payments. Residents call this while displaying the QR; invoice
   * refetch also reflects webhook-driven settlement.
   */
  async pollDuitNowQrStatus(
    actor: AuthenticatedUser,
    paymentId: string,
    kind: 'invoice' | 'advance',
  ) {
    const adapter = this.providers.get(PaymentProvider.DUITNOW_QR);
    if (!adapter?.pollStatus) throw new BadRequestException('DuitNow QR polling is not available');

    if (kind === 'invoice') {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      this.assertCanPayInvoice(actor, payment.invoice);
      if (payment.provider !== PaymentProvider.DUITNOW_QR) {
        throw new BadRequestException('Not a DuitNow QR payment');
      }
      if (payment.status !== PaymentStatus.PENDING) {
        return { status: payment.status, settled: payment.status === PaymentStatus.SUCCEEDED };
      }
      const resolved = await this.gateways.resolveCredentials(
        payment.invoice.condoId,
        PaymentProvider.DUITNOW_QR,
      );
      const poll = await adapter.pollStatus({
        providerRef: payment.providerRef ?? paymentId,
        credentials: resolved?.credentials,
        mode: resolved?.mode,
      });
      if (poll?.succeeded) {
        await this.markPaymentSucceeded(payment.providerRef ?? paymentId);
      } else if (poll?.failed) {
        await this.markPaymentFailed(payment.providerRef ?? paymentId, 'failed');
      }
      const refreshed = await this.prisma.payment.findUnique({ where: { id: paymentId } });
      return {
        status: refreshed?.status ?? payment.status,
        settled: refreshed?.status === PaymentStatus.SUCCEEDED,
        pending: poll?.pending ?? refreshed?.status === PaymentStatus.PENDING,
      };
    }

    const advance = await this.prisma.advancePayment.findUnique({ where: { id: paymentId } });
    if (!advance) throw new NotFoundException('Advance payment not found');
    this.assertCanPayUnit(actor, advance.condoId, advance.unitId);
    if (advance.provider !== PaymentProvider.DUITNOW_QR) {
      throw new BadRequestException('Not a DuitNow QR payment');
    }
    if (advance.status !== PaymentStatus.PENDING) {
      return { status: advance.status, settled: advance.status === PaymentStatus.SUCCEEDED };
    }
    const resolved = await this.gateways.resolveCredentials(
      advance.condoId,
      PaymentProvider.DUITNOW_QR,
    );
    const poll = await adapter.pollStatus({
      providerRef: advance.providerRef ?? paymentId,
      credentials: resolved?.credentials,
      mode: resolved?.mode,
    });
    if (poll?.succeeded) {
      await this.markAdvancePaymentSucceeded(advance.providerRef ?? paymentId);
    } else if (poll?.failed) {
      await this.markAdvancePaymentFailed(advance.providerRef ?? paymentId, 'failed');
    }
    const refreshed = await this.prisma.advancePayment.findUnique({ where: { id: paymentId } });
    return {
      status: refreshed?.status ?? advance.status,
      settled: refreshed?.status === PaymentStatus.SUCCEEDED,
      pending: poll?.pending ?? refreshed?.status === PaymentStatus.PENDING,
    };
  }

  /**
   * Stripe webhooks do not carry a condo id in the route. We first use the
   * payment intent id to locate the pending payment, then verify the signature
   * with that condo's stored webhook secret before mutating money state.
   */
  async handleStripeCallback(payload: Buffer, headers: Record<string, string | string[]>) {
    const providerRef = this.extractStripeProviderRef(payload);
    if (!providerRef) return { received: true };

    const payment = await this.findPaymentByProviderRef(providerRef);
    const advancePayment = payment ? null : await this.findAdvancePaymentByProviderRef(providerRef);
    if (!payment && !advancePayment) return { received: true };

    const adapter = this.providers.get(PaymentProvider.STRIPE);
    if (!adapter) return { received: true };

    const resolved = await this.gateways.resolveCredentials(
      payment?.invoice.condoId ?? advancePayment?.condoId ?? '',
      PaymentProvider.STRIPE,
    );
    const verified = await adapter.verifyWebhook({
      payload,
      headers,
      credentials: resolved?.credentials,
    });
    if (!verified) return { received: true };

    if (!verified.succeeded) {
      if (payment) {
        await this.markPaymentFailed(verified.providerRef, 'payment_failed');
      } else {
        await this.markAdvancePaymentFailed(verified.providerRef, 'payment_failed');
      }
      return { received: true };
    }

    const reportedAmount = this.extractStripeAmount(verified.raw);
    const expected = Number(payment?.amount ?? advancePayment?.amount ?? 0);
    if (Number.isFinite(reportedAmount) && Math.abs(reportedAmount - expected) > 0.01) {
      this.logger.warn(
        `Stripe amount mismatch for ${verified.providerRef}: reported ${reportedAmount}, expected ${expected}. Holding for review.`,
      );
      if (payment) {
        await this.flagPaymentForReview(verified.providerRef, reportedAmount, expected);
      } else {
        await this.flagAdvancePaymentForReview(verified.providerRef, reportedAmount, expected);
      }
      return { received: true };
    }

    if (payment) {
      await this.markPaymentSucceeded(verified.providerRef);
    } else {
      await this.markAdvancePaymentSucceeded(verified.providerRef);
    }
    return { received: true };
  }

  /** Mark a payment as needing manual review (e.g. gateway amount mismatch). */
  private async flagPaymentForReview(providerRef: string, reported: number, expected: number) {
    const payment = await this.findPaymentByProviderRef(providerRef);
    if (!payment || payment.status !== PaymentStatus.PENDING) return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...asJsonObject(payment.metadata),
          reviewReason: 'AMOUNT_MISMATCH',
          reportedAmount: reported,
          expectedAmount: expected,
          flaggedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async flagAdvancePaymentForReview(
    providerRef: string,
    reported: number,
    expected: number,
  ) {
    const payment = await this.findAdvancePaymentByProviderRef(providerRef);
    if (!payment || payment.status !== PaymentStatus.PENDING) return;
    await this.prisma.advancePayment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...asJsonObject(payment.metadata),
          reviewReason: 'AMOUNT_MISMATCH',
          reportedAmount: reported,
          expectedAmount: expected,
          flaggedAt: new Date().toISOString(),
        },
      },
    });
  }

  async markPaymentFailed(providerRef: string, gatewayStatus?: string) {
    const payment = await this.findPaymentByProviderRef(providerRef);
    if (!payment || payment.status !== PaymentStatus.PENDING) return null;
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.FAILED,
        metadata: {
          ...asJsonObject(payment.metadata),
          failedAt: new Date().toISOString(),
          ...(gatewayStatus ? { gatewayStatus } : {}),
        },
      },
    });
    if (updated.count === 0) return null;
    return this.prisma.payment.findUnique({ where: { id: payment.id } });
  }

  async markAdvancePaymentFailed(providerRef: string, gatewayStatus?: string) {
    const payment = await this.findAdvancePaymentByProviderRef(providerRef);
    if (!payment || payment.status !== PaymentStatus.PENDING) return null;
    const updated = await this.prisma.advancePayment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.FAILED,
        metadata: {
          ...asJsonObject(payment.metadata),
          failedAt: new Date().toISOString(),
          ...(gatewayStatus ? { gatewayStatus } : {}),
        },
      },
    });
    if (updated.count === 0) return null;
    return this.prisma.advancePayment.findUnique({ where: { id: payment.id } });
  }

  async markPaymentSucceeded(providerRef: string) {
    const payment = await this.findPaymentByProviderRef(providerRef);
    if (!payment) return null;
    if (payment.status === PaymentStatus.SUCCEEDED) return payment;
    const result = await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      });
      if (transitioned.count === 0) return { updated: null, settlement: null };

      await tx.payment.updateMany({
        where: {
          invoiceId: payment.invoiceId,
          status: PaymentStatus.PENDING,
          id: { not: payment.id },
        },
        data: { status: PaymentStatus.CANCELLED },
      });
      const updated = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      const settlement = await this.settleInvoice(tx, payment.invoiceId, {
        actorUserId: payment.userId,
        paymentId: payment.id,
        providerRef,
      });
      return { updated, settlement };
    });
    if (result.settlement?.fullyPaid) {
      this.events.emit('invoice.paid', { invoiceId: payment.invoiceId });
    }
    return result.updated;
  }

  async markAdvancePaymentSucceeded(providerRef: string) {
    const payment = await this.findAdvancePaymentByProviderRef(providerRef);
    if (!payment) return null;
    if (payment.status === PaymentStatus.SUCCEEDED) return payment;

    const result = await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.advancePayment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      });
      if (transitioned.count === 0) return null;

      const updated = await tx.advancePayment.findUnique({ where: { id: payment.id } });
      if (!updated) return null;

      const receipt = await this.receipts.issueInTx(tx, {
        condoId: updated.condoId,
        kind: 'PAYMENT',
        amount: Number(updated.amount),
        currencyCode: updated.currencyCode,
        issuedToUserId: updated.userId,
        unitId: updated.unitId,
        description: 'Advance maintenance payment',
      });

      await this.ledger.record(tx, {
        condoId: updated.condoId,
        unitId: updated.unitId,
        fund: 'GENERAL',
        type: 'PREPAYMENT',
        amount: Number(updated.amount),
        idempotencyKey: `advance-payment:${updated.id}:credit`,
        sourceType: 'AdvancePayment',
        sourceId: updated.id,
        memo: 'Advance maintenance payment',
        occurredAt: updated.paidAt ?? new Date(),
        createdByUserId: updated.userId,
      });
      await this.ledger.addCredit(tx, updated.condoId, updated.unitId, Number(updated.amount));
      await tx.auditLog.create({
        data: {
          condoId: updated.condoId,
          unitId: updated.unitId,
          actorUserId: updated.userId,
          action: AuditAction.PAYMENT,
          resourceType: 'AdvancePayment',
          resourceId: updated.id,
          metadata: {
            amount: Number(updated.amount),
            providerRef,
            receiptId: receipt.id,
          },
        },
      });

      return updated;
    });

    if (result) {
      await this.applyCreditToOutstanding(result.unitId, result.condoId);
    }
    return result;
  }

  /**
   * Manual / off-gateway settlement path (cash, bank transfer reconciled by
   * management, etc.). This is also the extension point a real FPX / card /
   * e-wallet webhook would funnel into: create a SUCCEEDED Payment row then
   * recompute the invoice. No external gateway credentials are involved here.
   */
  async recordManualPayment(
    actor: AuthenticatedUser,
    invoiceId: string,
    dto: RecordManualPaymentDto,
  ) {
    const invoice = await this.getInvoice(invoiceId, actor);
    this.assertCondoManagement(actor, invoice.condoId, true);
    if (invoice.status === InvoiceStatus.VOID)
      throw new BadRequestException('Cannot record a payment on a voided invoice');
    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Invoice is already fully paid');

    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    const amount = dto.amount != null ? Number(dto.amount) : outstanding;
    if (amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
    if (amount > outstanding + 0.005)
      throw new BadRequestException('Payment exceeds the outstanding balance');

    const settlement = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          userId: actor.id,
          amount,
          currencyCode: invoice.currencyCode,
          status: PaymentStatus.SUCCEEDED,
          provider: PaymentProvider.MANUAL,
          paidAt: new Date(),
          metadata: {
            method: dto.method ?? 'CASH',
            reference: dto.reference ?? null,
            note: dto.note ?? null,
            recordedByUserId: actor.id,
          },
        },
      });
      return this.settleInvoice(tx, invoice.id, {
        actorUserId: actor.id,
        paymentId: payment.id,
        providerRef: dto.reference ?? `manual_${payment.id}`,
      });
    });

    if (settlement?.fullyPaid) {
      this.events.emit('invoice.paid', { invoiceId: invoice.id });
    }
    return this.getInvoice(invoice.id);
  }

  async voidInvoice(actor: AuthenticatedUser, invoiceId: string, reason?: string) {
    const invoice = await this.getInvoice(invoiceId, actor);
    this.assertCondoManagement(actor, invoice.condoId, true);
    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Cannot void a fully paid invoice');
    if (Number(invoice.amountPaid) > 0.005)
      throw new BadRequestException(
        'Cannot void an invoice with payments; issue a refund or adjustment first',
      );
    if (invoice.status === InvoiceStatus.VOID) return invoice;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { invoiceId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CANCELLED },
      });
      await this.ledger.reverseInvoiceCharges(
        tx,
        {
          id: invoice.id,
          condoId: invoice.condoId,
          unitId: invoice.unitId,
          number: invoice.number,
        },
        actor.id,
        reason ?? null,
      );
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.VOID,
          voidedAt: new Date(),
          metadata: {
            ...asJsonObject(invoice.metadata),
            voidedByUserId: actor.id,
            voidReason: reason ?? null,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          condoId: invoice.condoId,
          unitId: invoice.unitId,
          actorUserId: actor.id,
          action: AuditAction.UPDATE,
          resourceType: 'Invoice',
          resourceId: invoiceId,
          metadata: { voided: true, reason: reason ?? null },
        },
      });
    });
    return this.getInvoice(invoiceId);
  }

  /**
   * Derive overdue status for a condo's outstanding invoices and surface
   * upcoming-due reminders. Idempotent: already-OVERDUE invoices are skipped
   * and "due soon" reminders fire at most once per invoice (guarded in
   * metadata). Intended to be triggered on demand by management (or a future
   * scheduled job) — no cron dependency is introduced.
   */
  async runDueSweep(actor: AuthenticatedUser, condoId: string) {
    this.assertCondoManagement(actor, condoId, true);
    const now = new Date();

    const overdue = await this.prisma.invoice.findMany({
      where: {
        condoId,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        dueDate: { lt: now },
      },
      select: { id: true },
    });
    if (overdue.length > 0) {
      await this.prisma.invoice.updateMany({
        where: { id: { in: overdue.map((i) => i.id) } },
        data: { status: InvoiceStatus.OVERDUE },
      });
      for (const inv of overdue) {
        this.events.emit('invoice.overdue', { invoiceId: inv.id });
      }
    }

    const soonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 86_400_000);
    const dueSoon = await this.prisma.invoice.findMany({
      where: {
        condoId,
        status: InvoiceStatus.ISSUED,
        dueDate: { gte: now, lte: soonCutoff },
      },
    });
    let dueSoonNotified = 0;
    for (const inv of dueSoon) {
      const meta = asJsonObject(inv.metadata);
      if (meta.dueSoonNotifiedAt) continue;
      await this.prisma.invoice.update({
        where: { id: inv.id },
        data: { metadata: { ...meta, dueSoonNotifiedAt: now.toISOString() } },
      });
      this.events.emit('invoice.due_soon', { invoiceId: inv.id });
      dueSoonNotified += 1;
    }

    return { overdue: overdue.length, dueSoonNotified, sweptAt: now.toISOString() };
  }

  /**
   * Generate a periodic maintenance-fee invoice for each targeted unit, guarding
   * against duplicates: a unit that already has a non-void invoice for the same
   * period start is skipped so re-running the cycle is safe.
   */
  /**
   * Generate a periodic invoice for each targeted unit. When explicit `lines`
   * are supplied they are billed uniformly to every unit; otherwise each unit's
   * maintenance + sinking-fund lines are computed from its unit type's fee rate
   * (the "automatically calculated from unit type" path). Duplicate periods and
   * units with no billable lines are skipped so re-running stays safe.
   */
  async generateRecurring(
    actor: AuthenticatedUser | null,
    condoId: string,
    dto: GenerateRecurringDto,
    options: GenerateRecurringOptions = {},
  ) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    if (!options.skipAuthorization) {
      if (!actor) throw new ForbiddenException('You cannot manage billing for this condo');
      this.assertCondoManagement(actor, condoId, true);
    }

    const explicitLines = (dto.lines ?? []).filter((l) => Number(l.unitPrice) > 0);
    const useFeeSchedule = explicitLines.length === 0;
    const actorUserId = options.triggeredByUserId ?? actor?.id ?? null;
    const extraScheduleLines = useFeeSchedule
      ? await this.feeSchedule.listActiveExtraLinesForPeriod(
          condoId,
          dto.periodStart,
          dto.periodEnd,
        )
      : [];

    const where = dto.unitIds?.length ? { condoId, id: { in: dto.unitIds } } : { condoId };
    const units = await this.prisma.unit.findMany({
      where,
      include: useFeeSchedule ? { unitType: { include: { feeRate: true } } } : undefined,
    });

    const createdInvoiceIds: string[] = [];
    let skipped = 0;
    let skippedNoRate = 0;
    for (const unit of units) {
      const lines = useFeeSchedule
        ? [
            ...this.feeSchedule.computeLinesForUnit(unit as never),
            ...this.feeSchedule.computeExtraLinesForUnit(unit as never, extraScheduleLines),
          ]
        : explicitLines.map((l) => ({
            code: l.code,
            description: l.description,
            formula: l.formula,
            unitPrice: Number(l.unitPrice),
            quantity: Number(l.quantity ?? 1),
          }));

      if (lines.length === 0) {
        skippedNoRate += 1;
        continue;
      }

      const existing = await this.prisma.invoice.count({
        where: {
          unitId: unit.id,
          periodStart: dto.periodStart,
          status: { not: InvoiceStatus.VOID },
        },
      });
      if (existing > 0) {
        skipped += 1;
        continue;
      }

      try {
        const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
        const invoice = await this.prisma.$transaction(async (tx) => {
          const number = await this.nextInvoiceNumber(tx, condoId);
          const created = await tx.invoice.create({
            data: {
              condoId,
              unitId: unit.id,
              number,
              periodStart: dto.periodStart,
              periodEnd: dto.periodEnd,
              dueDate: dto.dueDate,
              status: InvoiceStatus.ISSUED,
              issuedAt: new Date(),
              subtotal,
              total: subtotal,
              currencyCode: 'MYR',
              lines: {
                create: lines.map((l, i) => ({
                  code: l.code,
                  description: l.description,
                  formula: l.formula,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  amount: l.unitPrice * l.quantity,
                  sortOrder: i,
                })),
              },
              metadata: {
                recurring: true,
                fromFeeSchedule: useFeeSchedule,
                extraScheduleLineCount: extraScheduleLines.length,
                issuedByUserId: actor?.id ?? null,
                triggeredByUserId: actorUserId,
                ...options.metadata,
              },
            },
          });
          await this.ledger.recordInvoiceCharges(
            tx,
            { id: created.id, condoId, unitId: unit.id, issuedAt: created.issuedAt },
            lines.map((l) => ({
              code: l.code,
              amount: l.unitPrice * l.quantity,
              description: l.description,
            })),
            actorUserId,
          );
          return created;
        });
        createdInvoiceIds.push(invoice.id);
        await this.applyCreditToInvoice(invoice.id, unit.id, condoId);
      } catch (err) {
        if (this.isActivePeriodDuplicate(err)) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }

    for (const id of createdInvoiceIds) {
      this.events.emit('invoice.issued', { invoiceId: id });
    }

    return {
      created: createdInvoiceIds.length,
      skipped,
      skippedNoRate,
      units: units.length,
    };
  }

  /**
   * Recompute an invoice's paid amount and status from its SUCCEEDED payments.
   * Runs inside the caller's transaction so payment creation + invoice update
   * are atomic. Returns whether the invoice is now fully paid.
   */
  private async settleInvoice(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    ctx: { actorUserId: string | null; paymentId: string; providerRef: string },
  ): Promise<{ fullyPaid: boolean } | null> {
    const sums = await tx.payment.aggregate({
      where: { invoiceId, status: PaymentStatus.SUCCEEDED },
      _sum: { amount: true },
    });
    const paid = Number(sums._sum.amount ?? 0);
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;

    const fullyPaid = paid >= Number(invoice.total);
    const status = fullyPaid
      ? InvoiceStatus.PAID
      : paid > 0
        ? InvoiceStatus.PARTIAL
        : invoice.status;
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: paid,
        status,
        paidAt: fullyPaid ? new Date() : null,
      },
    });
    await tx.auditLog.create({
      data: {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        actorUserId: ctx.actorUserId,
        action: AuditAction.PAYMENT,
        resourceType: 'Payment',
        resourceId: ctx.paymentId,
        metadata: { providerRef: ctx.providerRef },
      },
    });

    const payment = await tx.payment.findUnique({ where: { id: ctx.paymentId } });
    if (payment) {
      await this.ledger.recordPaymentAllocation(tx, {
        invoiceId,
        paymentId: ctx.paymentId,
        amount: Number(payment.amount),
        occurredAt: payment.paidAt ?? new Date(),
        actorUserId: ctx.actorUserId,
      });

      // Auto-issue an official receipt for real payments (not internal
      // prepayment-credit applications, which already have their own receipt).
      const method = asJsonObject(payment.metadata).method;
      if (method !== 'PREPAYMENT_APPLIED') {
        await this.receipts.issueInTx(tx, {
          condoId: invoice.condoId,
          kind: 'PAYMENT',
          amount: Number(payment.amount),
          currencyCode: invoice.currencyCode,
          issuedToUserId: payment.userId,
          unitId: invoice.unitId,
          paymentId: payment.id,
          description: `Payment for invoice ${invoice.number}`,
        });
      }
    }
    return { fullyPaid };
  }

  /**
   * Record an advance (prepayment) maintenance payment as a unit credit that
   * offsets current and future invoices. Issues a payment receipt and applies
   * the credit to any outstanding invoices immediately (oldest first).
   */
  async recordPrepayment(actor: AuthenticatedUser, dto: RecordPrepaymentDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    this.assertCondoManagement(actor, unit.condoId, true);
    if (dto.amount <= 0) throw new BadRequestException('Amount must be greater than zero');

    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await this.receipts.issueInTx(tx, {
        condoId: unit.condoId,
        kind: 'PAYMENT',
        amount: dto.amount,
        issuedToUserId: dto.userId ?? null,
        unitId: unit.id,
        description: 'Advance maintenance payment',
      });
      await this.ledger.record(tx, {
        condoId: unit.condoId,
        unitId: unit.id,
        fund: 'GENERAL',
        type: 'PREPAYMENT',
        amount: dto.amount,
        idempotencyKey: `prepayment:${receipt.id}`,
        sourceType: 'Prepayment',
        sourceId: receipt.id,
        memo: 'Advance maintenance payment',
        createdByUserId: actor.id,
      });
      await this.ledger.addCredit(tx, unit.condoId, unit.id, dto.amount);
      await tx.auditLog.create({
        data: {
          condoId: unit.condoId,
          unitId: unit.id,
          actorUserId: actor.id,
          action: AuditAction.PAYMENT,
          resourceType: 'Prepayment',
          resourceId: receipt.id,
          metadata: { amount: dto.amount, method: dto.method ?? null },
        },
      });
      return { receipt };
    });

    await this.applyCreditToOutstanding(unit.id, unit.condoId);
    return { credit: await this.ledger.getCredit(unit.id), receiptId: result.receipt.id };
  }

  /** Apply available unit credit to outstanding invoices, oldest due first. */
  private async applyCreditToOutstanding(unitId: string, condoId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        unitId,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      },
      orderBy: { dueDate: 'asc' },
      select: { id: true },
    });
    for (const inv of invoices) {
      const credit = await this.ledger.getCredit(unitId);
      if (credit <= 0.005) break;
      await this.applyCreditToInvoice(inv.id, unitId, condoId);
    }
  }

  /** Apply available unit credit to a single invoice (settles + records ledger). */
  private async applyCreditToInvoice(invoiceId: string, unitId: string, condoId: string) {
    if ((await this.ledger.getCredit(unitId)) <= 0.005) return;
    const settlement = await this.prisma.$transaction(async (tx) => {
      const account = await tx.unitAccount.findUnique({ where: { unitId } });
      const credit = Number(account?.creditBalance ?? 0);
      if (credit <= 0.005) return null;
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (
        !invoice ||
        invoice.status === InvoiceStatus.VOID ||
        invoice.status === InvoiceStatus.PAID
      )
        return null;
      const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
      const apply = Math.min(credit, outstanding);
      if (apply <= 0.005) return null;

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          userId: null,
          amount: apply,
          currencyCode: invoice.currencyCode,
          status: PaymentStatus.SUCCEEDED,
          provider: PaymentProvider.MANUAL,
          paidAt: new Date(),
          metadata: { method: 'PREPAYMENT_APPLIED' },
        },
      });
      const result = await this.settleInvoice(tx, invoiceId, {
        actorUserId: null,
        paymentId: payment.id,
        providerRef: `prepay_${payment.id}`,
      });
      await this.ledger.consumeCredit(tx, unitId, apply);
      await this.ledger.record(tx, {
        condoId,
        unitId,
        fund: 'GENERAL',
        type: 'PREPAYMENT_APPLIED',
        amount: -apply,
        idempotencyKey: `invoice:${invoiceId}:prepayment:${payment.id}`,
        sourceType: 'Invoice',
        sourceId: invoiceId,
        memo: 'Prepayment applied',
      });
      return result;
    });
    if (settlement?.fullyPaid) {
      this.events.emit('invoice.paid', { invoiceId });
    }
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient, condoId: string): Promise<string> {
    const year = new Date().getFullYear();
    const existingMax = await this.maxExistingNumberSuffix(tx, 'invoice', condoId, `INV-${year}-`);
    const seq = await tx.billingNumberSequence.upsert({
      where: { condoId_kind_year: { condoId, kind: 'INVOICE', year } },
      create: { condoId, kind: 'INVOICE', year, lastNumber: existingMax + 1 },
      update: { lastNumber: { increment: 1 } },
    });
    if (seq.lastNumber <= existingMax) {
      const repaired = await tx.billingNumberSequence.update({
        where: { condoId_kind_year: { condoId, kind: 'INVOICE', year } },
        data: { lastNumber: existingMax + 1 },
      });
      return `INV-${year}-${repaired.lastNumber.toString().padStart(6, '0')}`;
    }
    return `INV-${year}-${seq.lastNumber.toString().padStart(6, '0')}`;
  }

  private async maxExistingNumberSuffix(
    tx: Prisma.TransactionClient,
    model: 'invoice' | 'receipt',
    condoId: string,
    prefix: string,
  ): Promise<number> {
    const rows =
      model === 'invoice'
        ? await tx.invoice.findMany({
            where: { condoId, number: { startsWith: prefix } },
            select: { number: true },
          })
        : await tx.receipt.findMany({
            where: { condoId, number: { startsWith: prefix } },
            select: { number: true },
          });
    return rows.reduce((max, row) => {
      const suffix = Number(row.number.slice(prefix.length));
      return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, 0);
  }

  /** Failed gateway attempts and pending payments flagged for manual review. */
  async listPaymentIssues(actor: AuthenticatedUser, condoId: string) {
    this.assertCondoManagement(actor, condoId, false);
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { condoId },
        status: { in: [PaymentStatus.FAILED, PaymentStatus.PENDING] },
      },
      include: {
        invoice: { include: { unit: { include: { block: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return payments
      .filter((p) => {
        if (p.status === PaymentStatus.FAILED) return true;
        return Boolean(asJsonObject(p.metadata).reviewReason);
      })
      .map((p) => {
        const meta = asJsonObject(p.metadata);
        const unit = p.invoice.unit;
        const unitLabel = formatCompactUnitLabel(unit);
        return {
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice.number,
          unitIdentifier: unitLabel,
          amount: Number(p.amount),
          currencyCode: p.currencyCode,
          status: p.status,
          provider: p.provider,
          providerRef: p.providerRef,
          createdAt: p.createdAt.toISOString(),
          reviewReason: meta.reviewReason as string | undefined,
          reportedAmount: meta.reportedAmount as number | undefined,
          expectedAmount: meta.expectedAmount as number | undefined,
          gatewayStatus: meta.gatewayStatus as string | undefined,
        };
      });
  }

  async dismissPayment(actor: AuthenticatedUser, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    this.assertCondoManagement(actor, payment.invoice.condoId, true);
    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException('Only pending or failed payments can be dismissed');
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.CANCELLED,
        metadata: {
          ...asJsonObject(payment.metadata),
          dismissedByUserId: actor.id,
          dismissedAt: new Date().toISOString(),
        },
      },
    });
  }

  async approveReviewedPayment(actor: AuthenticatedUser, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    this.assertCondoManagement(actor, payment.invoice.condoId, true);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be approved');
    }
    const meta = asJsonObject(payment.metadata);
    if (!meta.reviewReason) {
      throw new BadRequestException('Payment is not flagged for review');
    }
    if (!payment.providerRef) {
      throw new BadRequestException('Payment has no gateway reference');
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        metadata: {
          ...meta,
          approvedByUserId: actor.id,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    return this.markPaymentSucceeded(payment.providerRef);
  }

  private extractStripeProviderRef(payload: Buffer): string | null {
    try {
      const event = JSON.parse(payload.toString('utf8')) as {
        data?: { object?: { id?: unknown } };
      };
      const id = event.data?.object?.id;
      return typeof id === 'string' ? id : null;
    } catch {
      return null;
    }
  }

  private extractStripeAmount(raw: unknown): number {
    const object = (raw as { data?: { object?: Record<string, unknown> } })?.data?.object;
    const cents =
      typeof object?.amount_received === 'number'
        ? object.amount_received
        : typeof object?.amount === 'number'
          ? object.amount
          : Number.NaN;
    return Number.isFinite(cents) ? Math.round((cents / 100) * 100) / 100 : Number.NaN;
  }

  private async assertCanReadUnitMoney(user: AuthenticatedUser, unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (this.canReadUnitMoney(user, unit.condoId, unitId)) return;
    throw new ForbiddenException('You cannot access billing records for this unit');
  }

  private assertCanReadInvoice(
    user: AuthenticatedUser,
    invoice: { condoId: string; unitId: string },
  ) {
    if (this.canReadUnitMoney(user, invoice.condoId, invoice.unitId)) return;
    throw new ForbiddenException('You cannot access this invoice');
  }

  private assertCanPayInvoice(
    user: AuthenticatedUser,
    invoice: { condoId: string; unitId: string },
  ) {
    const allowed = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === invoice.condoId) ||
        (r.roleId === RoleId.UNIT_OWNER && r.unitId === invoice.unitId),
    );
    if (!allowed) throw new ForbiddenException('You cannot pay this invoice');
  }

  private assertCanPayUnit(user: AuthenticatedUser, condoId: string, unitId: string) {
    const allowed = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId) ||
        (r.roleId === RoleId.UNIT_OWNER && r.unitId === unitId),
    );
    if (!allowed) throw new ForbiddenException('You cannot make an advance payment for this unit');
  }

  private canReadUnitMoney(user: AuthenticatedUser, condoId: string, unitId: string): boolean {
    return user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId) ||
        r.unitId === unitId,
    );
  }

  private assertCondoManagement(
    user: AuthenticatedUser,
    condoId: string,
    adminOnly: boolean,
  ): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId) ||
        (!adminOnly && r.roleId === RoleId.MANAGEMENT_STAFF && r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('You cannot manage billing for this condo');
  }

  private isActivePeriodDuplicate(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
      return false;
    }
    const target = err.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('unitId') && target.includes('periodStart');
    }
    return String(target ?? '').includes('invoices_unitId_periodStart_active_key');
  }

  static prismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Invoice number must be unique within the condo');
    }
    throw err as Error;
  }
}
