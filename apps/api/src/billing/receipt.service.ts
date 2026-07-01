import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, type Receipt, type ReceiptKind, RoleId } from '@prisma/client';
import {
  DEPOSIT_STATUS_LABELS,
  depositHeldAmount,
  formatCompactUnitLabel,
  formatMoney,
} from '@smartresidence/shared-types';
import { type ReceiptPdfData, buildReceiptPdf } from './receipt-pdf';
import { parseReceiptTemplate } from './receipt-template';

const RECEIPT_KIND_LABELS: Record<ReceiptKind, string> = {
  PAYMENT: 'Payment',
  DEPOSIT: 'Deposit',
  REFUND: 'Refund',
};

/** Bumped when receipt PDF layout changes so cached objects are regenerated. */
const RECEIPT_PDF_LAYOUT_VERSION = 'v2';

function receiptPdfStorageKey(condoId: string, receiptId: string): string {
  return `receipts/${RECEIPT_PDF_LAYOUT_VERSION}/${condoId}/${receiptId}.pdf`;
}

interface IssueReceiptInput {
  condoId: string;
  kind: ReceiptKind;
  amount: number;
  currencyCode?: string;
  issuedToUserId?: string | null;
  unitId?: string | null;
  paymentId?: string | null;
  depositId?: string | null;
  description?: string | null;
}

@Injectable()
export class ReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Create a receipt row inside the caller's transaction so it is atomic with
   * the payment/deposit it documents. The receipt PDF is rendered lazily on
   * first download (see {@link getPdf}) to keep transactions short. The active
   * template is snapshotted now so a reprint always matches what was issued.
   */
  async issueInTx(tx: Prisma.TransactionClient, input: IssueReceiptInput): Promise<Receipt> {
    const condo = await tx.condo.findUnique({ where: { id: input.condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const template = parseReceiptTemplate(condo.settings);
    const number = await this.nextReceiptNumber(tx, input.condoId, template.numberPrefix);

    return tx.receipt.create({
      data: {
        condoId: input.condoId,
        number,
        kind: input.kind,
        amount: input.amount,
        currencyCode: input.currencyCode ?? condo.currencyCode ?? 'MYR',
        issuedToUserId: input.issuedToUserId ?? null,
        unitId: input.unitId ?? null,
        paymentId: input.paymentId ?? null,
        depositId: input.depositId ?? null,
        description: input.description ?? null,
        templateSnapshot: template as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async nextReceiptNumber(
    tx: Prisma.TransactionClient,
    condoId: string,
    prefix: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const numberPrefix = `${prefix}-${year}-`;
    const existingMax = await this.maxExistingReceiptSuffix(tx, condoId, numberPrefix);
    const seq = await tx.billingNumberSequence.upsert({
      where: { condoId_kind_year: { condoId, kind: 'RECEIPT', year } },
      create: { condoId, kind: 'RECEIPT', year, lastNumber: existingMax + 1 },
      update: { lastNumber: { increment: 1 } },
    });
    if (seq.lastNumber <= existingMax) {
      const repaired = await tx.billingNumberSequence.update({
        where: { condoId_kind_year: { condoId, kind: 'RECEIPT', year } },
        data: { lastNumber: existingMax + 1 },
      });
      return `${numberPrefix}${repaired.lastNumber.toString().padStart(6, '0')}`;
    }
    return `${numberPrefix}${seq.lastNumber.toString().padStart(6, '0')}`;
  }

  private async maxExistingReceiptSuffix(
    tx: Prisma.TransactionClient,
    condoId: string,
    prefix: string,
  ): Promise<number> {
    const rows = await tx.receipt.findMany({
      where: { condoId, number: { startsWith: prefix } },
      select: { number: true },
    });
    return rows.reduce((max, row) => {
      const suffix = Number(row.number.slice(prefix.length));
      return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, 0);
  }

  async listForCondo(
    actor: AuthenticatedUser,
    condoId: string,
    opts: { limit: number; offset: number; kind?: ReceiptKind },
  ) {
    this.assertCanReadCondo(actor, condoId);
    const where = { condoId, ...(opts.kind ? { kind: opts.kind } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.receipt.findMany({
        where,
        include: { unit: true, issuedTo: { select: { id: true, name: true } } },
        orderBy: { issuedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.receipt.count({ where }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async listForUnit(
    actor: AuthenticatedUser,
    unitId: string,
    opts: { limit: number; offset: number },
  ) {
    await this.assertCanReadUnit(actor, unitId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.receipt.findMany({
        where: { unitId },
        orderBy: { issuedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.receipt.count({ where: { unitId } }),
    ]);
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: { unit: true, issuedTo: { select: { id: true, name: true } } },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    this.assertCanRead(actor, receipt.condoId, receipt.unitId, receipt.issuedToUserId);
    return receipt;
  }

  /** Render (or fetch the cached) receipt PDF and return it as a buffer. */
  async getPdf(user: AuthenticatedUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        unit: { include: { block: true } },
        issuedTo: { select: { id: true, name: true } },
        payment: true,
        deposit: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    this.assertCanRead(user, receipt.condoId, receipt.unitId, receipt.issuedToUserId);

    const filename = `${receipt.number}.pdf`;
    const cacheKey = receiptPdfStorageKey(receipt.condoId, receipt.id);
    if (receipt.pdfKey === cacheKey) {
      try {
        const stream = await this.storage.getObjectStream(receipt.pdfKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        return { buffer: Buffer.concat(chunks), filename };
      } catch {
        // Fall through and re-render if the cached object is missing.
      }
    }

    const template = parseReceiptTemplate({ billing: { receipt: receipt.templateSnapshot } });
    const unitLabel = receipt.unit ? formatCompactUnitLabel(receipt.unit) : undefined;

    // When the underlying invoice has a validated LHDN e-invoice, surface its
    // identifiers + verification link on the receipt PDF.
    let eInvoice: {
      lhdnUuid: string | null;
      lhdnLongId: string | null;
      validationUrl: string | null;
    } | null = null;
    if (receipt.payment?.invoiceId) {
      eInvoice = await this.prisma.eInvoice.findFirst({
        where: { invoiceId: receipt.payment.invoiceId, status: 'VALID' },
        select: { lhdnUuid: true, lhdnLongId: true, validationUrl: true },
      });
    }

    const dateFmt: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const formatDate = (d: Date) => d.toLocaleDateString('en-MY', dateFmt);

    const deposit = receipt.deposit;
    const depositSummary =
      receipt.kind === 'DEPOSIT' && deposit
        ? (() => {
            const currency = deposit.currencyCode ?? receipt.currencyCode;
            const original = Number(deposit.amount);
            const refunded = Number(deposit.refundedAmount);
            const forfeited = Number(deposit.forfeitedAmount);
            const held = depositHeldAmount({
              amount: original,
              refundedAmount: refunded,
              forfeitedAmount: forfeited,
            });
            return {
              statusLabel: DEPOSIT_STATUS_LABELS[deposit.status],
              paidAt: formatDate(deposit.paidAt),
              originalAmount: formatMoney(original, currency),
              ...(refunded > 0 ? { refundedAmount: formatMoney(refunded, currency) } : {}),
              ...(forfeited > 0 ? { forfeitedAmount: formatMoney(forfeited, currency) } : {}),
              heldAmount: formatMoney(held, currency),
              notes: deposit.notes?.trim() || undefined,
            };
          })()
        : undefined;

    const pdfData: ReceiptPdfData = {
      organizationName: template.organizationName,
      registrationNo: template.registrationNo || undefined,
      addressLines: template.addressLines || undefined,
      receiptNumber: receipt.number,
      kind: receipt.kind,
      kindLabel: RECEIPT_KIND_LABELS[receipt.kind],
      issuedAt: formatDate(receipt.issuedAt),
      issuedToName: receipt.issuedTo?.name ?? deposit?.user?.name ?? undefined,
      unitLabel,
      description: receipt.description ?? undefined,
      amountLabel: formatMoney(Number(receipt.amount), receipt.currencyCode),
      methodLabel: receipt.payment?.provider ?? deposit?.method ?? undefined,
      referenceLabel: receipt.payment?.providerRef ?? deposit?.reference ?? undefined,
      depositSummary,
      footerNote: template.footerNote || undefined,
      signatoryName: template.signatoryName || undefined,
      signatoryTitle: template.signatoryTitle || undefined,
      eInvoiceUuid: eInvoice?.lhdnUuid ?? undefined,
      eInvoiceLongId: eInvoice?.lhdnLongId ?? undefined,
      eInvoiceValidationUrl: eInvoice?.validationUrl ?? undefined,
    };
    const buffer = buildReceiptPdf(pdfData);

    const key = receiptPdfStorageKey(receipt.condoId, receipt.id);
    try {
      await this.storage.putObject({ key, body: buffer, contentType: 'application/pdf' });
      await this.prisma.receipt.update({ where: { id: receipt.id }, data: { pdfKey: key } });
    } catch {
      // Storage is best-effort: still return the freshly rendered PDF.
    }
    return { buffer, filename };
  }

  private assertCanRead(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string | null,
    issuedToUserId: string | null,
  ): void {
    const isManagement = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
    if (isManagement) return;
    if (issuedToUserId && issuedToUserId === user.id) return;
    if (unitId && user.roles.some((r) => r.unitId === unitId)) return;
    throw new ForbiddenException('You cannot access this receipt');
  }

  private assertCanReadCondo(user: AuthenticatedUser, condoId: string): void {
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === condoId),
    );
    if (!ok) throw new ForbiddenException('You cannot access receipts for this condo');
  }

  private async assertCanReadUnit(user: AuthenticatedUser, unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    const ok = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === unit.condoId) ||
        r.unitId === unitId,
    );
    if (!ok) throw new ForbiddenException('You cannot access receipts for this unit');
  }
}
