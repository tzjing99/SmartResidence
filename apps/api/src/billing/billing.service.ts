import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, InvoiceStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import type {
  CreateInvoiceDto,
  CreatePaymentDto,
  GenerateRecurringDto,
  RecordManualPaymentDto,
} from './dto/billing.dto';
import { FpxAdapter } from './providers/fpx.adapter';
import type { PaymentProviderAdapter } from './providers/payment-provider.interface';
import { StripeAdapter } from './providers/stripe.adapter';

/** Invoices this many days from their due date are flagged "due soon" in the sweep. */
const DUE_SOON_WINDOW_DAYS = 5;

type JsonObject = Record<string, unknown>;

const asJsonObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {};

@Injectable()
export class BillingService {
  private readonly providers: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    stripe: StripeAdapter,
    fpx: FpxAdapter,
  ) {
    this.providers = new Map<PaymentProvider, PaymentProviderAdapter>([
      [PaymentProvider.STRIPE, stripe],
      [PaymentProvider.FPX, fpx],
    ]);
  }

  async listForUnit(unitId: string, opts: { limit: number; offset: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: { unitId },
        include: { lines: { orderBy: { sortOrder: 'asc' } }, payments: true },
        orderBy: { dueDate: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.invoice.count({ where: { unitId } }),
    ]);
    return { items, total, ...opts };
  }

  async listForCondo(
    condoId: string,
    opts: { limit: number; offset: number; status?: InvoiceStatus },
  ) {
    const where = { condoId, ...(opts.status ? { status: opts.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { unit: true, payments: true },
        orderBy: { dueDate: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: true,
        unit: true,
        condo: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(actor: AuthenticatedUser, dto: CreateInvoiceDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const subtotal = dto.lines.reduce(
      (sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1),
      0,
    );
    const total = subtotal;
    const number = await this.nextInvoiceNumber(unit.condoId);

    const invoice = await this.prisma.invoice.create({
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

    this.events.emit('invoice.issued', { invoiceId: invoice.id });
    return invoice;
  }

  async createPayment(actor: AuthenticatedUser, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Invoice already paid');
    const adapter = this.providers.get(dto.provider);
    if (!adapter) throw new BadRequestException(`Unsupported provider: ${dto.provider}`);

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        userId: actor.id,
        amount: invoice.total,
        currencyCode: invoice.currencyCode,
        status: PaymentStatus.PENDING,
        provider: dto.provider,
      },
    });

    const intent = await adapter.createIntent({
      invoice,
      payment,
      returnUrl: dto.returnUrl,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: intent.providerRef },
    });

    return { paymentId: payment.id, ...intent };
  }

  async markPaymentSucceeded(providerRef: string) {
    const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (!payment) return null;
    if (payment.status === PaymentStatus.SUCCEEDED) return payment;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
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
    const invoice = await this.getInvoice(invoiceId);
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
    const invoice = await this.getInvoice(invoiceId);
    if (invoice.status === InvoiceStatus.PAID)
      throw new BadRequestException('Cannot void a fully paid invoice');
    if (invoice.status === InvoiceStatus.VOID) return invoice;

    await this.prisma.$transaction(async (tx) => {
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
  async runDueSweep(condoId: string) {
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
  async generateRecurring(
    actor: AuthenticatedUser,
    condoId: string,
    dto: GenerateRecurringDto,
  ) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const units = dto.unitIds?.length
      ? await this.prisma.unit.findMany({ where: { condoId, id: { in: dto.unitIds } } })
      : await this.prisma.unit.findMany({ where: { condoId } });

    const subtotal = dto.lines.reduce(
      (sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1),
      0,
    );

    const createdInvoiceIds: string[] = [];
    let skipped = 0;
    for (const unit of units) {
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
      const number = await this.nextInvoiceNumber(condoId);
      const invoice = await this.prisma.invoice.create({
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
          metadata: { recurring: true, issuedByUserId: actor.id },
        },
      });
      createdInvoiceIds.push(invoice.id);
    }

    for (const id of createdInvoiceIds) {
      this.events.emit('invoice.issued', { invoiceId: id });
    }

    return { created: createdInvoiceIds.length, skipped, units: units.length };
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
    return { fullyPaid };
  }

  private async nextInvoiceNumber(condoId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { condoId } });
    return `INV-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  static prismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Invoice number must be unique within the condo');
    }
    throw err as Error;
  }
}
