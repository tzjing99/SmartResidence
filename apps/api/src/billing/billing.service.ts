import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, InvoiceStatus, PaymentProvider, PaymentStatus, AuditAction } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import type { CreateInvoiceDto, CreatePaymentDto } from './dto/billing.dto';
import { StripeAdapter } from './providers/stripe.adapter';
import { FpxAdapter } from './providers/fpx.adapter';
import type { PaymentProviderAdapter } from './providers/payment-provider.interface';

@Injectable()
export class BillingService {
  private readonly providers: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
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

  async listForCondo(condoId: string, opts: { limit: number; offset: number; status?: InvoiceStatus }) {
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
      include: { lines: { orderBy: { sortOrder: 'asc' } }, payments: true, unit: true, condo: true },
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

    return this.prisma.invoice.create({
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
  }

  async createPayment(actor: AuthenticatedUser, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Invoice already paid');
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
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      });
      const sums = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId, status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
      });
      const paid = Number(sums._sum.amount ?? 0);
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const status =
          paid >= Number(invoice.total)
            ? InvoiceStatus.PAID
            : paid > 0
              ? InvoiceStatus.PARTIAL
              : invoice.status;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: paid,
            status,
            paidAt: status === InvoiceStatus.PAID ? new Date() : null,
          },
        });
        await tx.auditLog.create({
          data: {
            condoId: invoice.condoId,
            unitId: invoice.unitId,
            actorUserId: payment.userId,
            action: AuditAction.PAYMENT,
            resourceType: 'Payment',
            resourceId: payment.id,
            metadata: { providerRef },
          },
        });
      }
      return updated;
    });
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
