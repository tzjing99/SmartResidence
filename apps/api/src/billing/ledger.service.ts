import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, LedgerEntryType, LedgerFund, type Prisma, RoleId } from '@prisma/client';
import type {
  ArrearsAging,
  ArrearsAgingBucket,
  CollectionsSummary,
  FundBalance,
  UnitStatement,
  UnitStatementEntry,
} from '@smartresidence/shared-types';

type Client = PrismaService | Prisma.TransactionClient;

interface LedgerEntryInput {
  condoId: string;
  unitId?: string | null;
  fund: LedgerFund;
  type: LedgerEntryType;
  amount: number;
  idempotencyKey?: string | null;
  sourceType: string;
  sourceId?: string | null;
  memo?: string | null;
  occurredAt?: Date;
  createdByUserId?: string | null;
}

const ARREARS_STATUSES = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE];

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Map an invoice-line code to its accounting fund. */
  static fundOfCode(code: string): LedgerFund {
    const c = code.toUpperCase();
    if (c.includes('SINK')) return LedgerFund.SINKING_FUND;
    if (c.includes('MAINT')) return LedgerFund.MAINTENANCE;
    return LedgerFund.GENERAL;
  }

  async record(client: Client, entry: LedgerEntryInput) {
    const data = {
      condoId: entry.condoId,
      unitId: entry.unitId ?? null,
      fund: entry.fund,
      type: entry.type,
      amount: entry.amount,
      idempotencyKey: entry.idempotencyKey ?? null,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId ?? null,
      memo: entry.memo ?? null,
      occurredAt: entry.occurredAt ?? new Date(),
      createdByUserId: entry.createdByUserId ?? null,
    };
    if (entry.idempotencyKey) {
      return client.ledgerEntry.upsert({
        where: { idempotencyKey: entry.idempotencyKey },
        update: {},
        create: data,
      });
    }
    return client.ledgerEntry.create({ data });
  }

  /** Write a CHARGE entry per invoice line, fund-tagged by line code. */
  async recordInvoiceCharges(
    client: Client,
    invoice: {
      id: string;
      condoId: string;
      unitId: string;
      issuedAt?: Date | null;
    },
    lines: Array<{ code: string; amount: number; description: string }>,
    actorUserId?: string | null,
  ) {
    for (const [i, line] of lines.entries()) {
      await this.record(client, {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        fund: LedgerService.fundOfCode(line.code),
        type: LedgerEntryType.CHARGE,
        amount: line.amount,
        idempotencyKey: `invoice:${invoice.id}:charge:${i}`,
        sourceType: 'Invoice',
        sourceId: invoice.id,
        memo: line.description,
        occurredAt: invoice.issuedAt ?? new Date(),
        createdByUserId: actorUserId ?? null,
      });
    }
  }

  /** Write compensating entries for invoice charges when an unpaid invoice is voided. */
  async reverseInvoiceCharges(
    client: Client,
    invoice: { id: string; condoId: string; unitId: string; number?: string },
    actorUserId?: string | null,
    reason?: string | null,
  ) {
    const charges = await client.ledgerEntry.findMany({
      where: {
        sourceType: 'Invoice',
        sourceId: invoice.id,
        type: LedgerEntryType.CHARGE,
      },
      orderBy: { occurredAt: 'asc' },
    });

    for (const charge of charges) {
      await this.record(client, {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        fund: charge.fund,
        type: LedgerEntryType.ADJUSTMENT,
        amount: -Number(charge.amount),
        idempotencyKey: `invoice:${invoice.id}:void:${charge.id}`,
        sourceType: 'Invoice',
        sourceId: invoice.id,
        memo: `Void reversal${invoice.number ? ` for ${invoice.number}` : ''}${reason ? ` — ${reason}` : ''}`,
        createdByUserId: actorUserId ?? null,
      });
    }
  }

  /**
   * Allocate a payment across funds proportional to the invoice's line
   * distribution and write a PAYMENT entry per fund (rounding remainder lands
   * on the largest fund so the allocation always sums to the payment amount).
   */
  async recordPaymentAllocation(
    client: Client,
    opts: {
      invoiceId: string;
      paymentId: string;
      amount: number;
      occurredAt?: Date;
      actorUserId?: string | null;
    },
  ) {
    const invoice = await client.invoice.findUnique({
      where: { id: opts.invoiceId },
      include: { lines: true },
    });
    if (!invoice) return;

    const byFund = new Map<LedgerFund, number>();
    let lineTotal = 0;
    for (const line of invoice.lines) {
      const fund = LedgerService.fundOfCode(line.code);
      const amt = Number(line.amount);
      byFund.set(fund, (byFund.get(fund) ?? 0) + amt);
      lineTotal += amt;
    }
    if (lineTotal <= 0) {
      byFund.clear();
      byFund.set(LedgerFund.GENERAL, opts.amount);
    }

    const funds = [...byFund.entries()];
    let allocated = 0;
    const allocations = funds.map(([fund, fundTotal], i) => {
      const isLast = i === funds.length - 1;
      const share =
        lineTotal > 0
          ? isLast
            ? opts.amount - allocated
            : Math.round(((opts.amount * fundTotal) / lineTotal) * 100) / 100
          : opts.amount;
      allocated += share;
      return { fund, share };
    });

    for (const { fund, share } of allocations) {
      if (Math.abs(share) < 0.005) continue;
      await this.record(client, {
        condoId: invoice.condoId,
        unitId: invoice.unitId,
        fund,
        type: LedgerEntryType.PAYMENT,
        amount: share,
        idempotencyKey: `payment:${opts.paymentId}:${fund}`,
        sourceType: 'Payment',
        sourceId: opts.paymentId,
        memo: `Payment for ${invoice.number}`,
        occurredAt: opts.occurredAt ?? new Date(),
        actorUserId: opts.actorUserId,
      } as LedgerEntryInput);
    }
  }

  // -- Prepayment credit ----------------------------------------------

  async getCredit(unitId: string): Promise<number> {
    const account = await this.prisma.unitAccount.findUnique({ where: { unitId } });
    return Number(account?.creditBalance ?? 0);
  }

  async addCredit(client: Client, condoId: string, unitId: string, amount: number) {
    await client.unitAccount.upsert({
      where: { unitId },
      update: { creditBalance: { increment: amount } },
      create: { condoId, unitId, creditBalance: amount },
    });
  }

  async consumeCredit(client: Client, unitId: string, amount: number) {
    const updated = await client.unitAccount.updateMany({
      where: { unitId, creditBalance: { gte: amount } },
      data: { creditBalance: { decrement: amount } },
    });
    if (updated.count === 0) {
      throw new BadRequestException('Insufficient unit credit');
    }
  }

  // -- Reports --------------------------------------------------------

  async fundBalances(condoId: string): Promise<FundBalance[]> {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['fund'],
      where: { condoId, type: { not: LedgerEntryType.CHARGE } },
      _sum: { amount: true },
    });
    const map = new Map<LedgerFund, number>(
      grouped.map((g) => [g.fund, Number(g._sum.amount ?? 0)]),
    );
    return (Object.values(LedgerFund) as LedgerFund[]).map((fund) => ({
      fund,
      balance: map.get(fund) ?? 0,
    }));
  }

  async collectionsSummary(condoId: string, from: Date, to: Date): Promise<CollectionsSummary> {
    const where = {
      condoId,
      type: LedgerEntryType.PAYMENT,
      occurredAt: { gte: from, lte: to },
    };
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['fund'],
      where,
      _sum: { amount: true },
      _count: true,
    });
    const byFund: FundBalance[] = grouped.map((g) => ({
      fund: g.fund,
      balance: Number(g._sum.amount ?? 0),
    }));
    const total = byFund.reduce((sum, f) => sum + f.balance, 0);
    const count = grouped.reduce((sum, g) => sum + g._count, 0);
    return { from: from.toISOString(), to: to.toISOString(), total, count, byFund };
  }

  async arrearsAging(condoId: string): Promise<ArrearsAging> {
    const invoices = await this.prisma.invoice.findMany({
      where: { condoId, status: { in: ARREARS_STATUSES } },
      select: { unitId: true, total: true, amountPaid: true, dueDate: true },
    });
    const now = Date.now();
    const buckets: Record<ArrearsAgingBucket['bucket'], { amount: number; count: number }> = {
      '0-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };
    let totalOutstanding = 0;
    let invoicesInArrears = 0;
    const unitsInArrears = new Set<string>();
    for (const inv of invoices) {
      const outstanding = Number(inv.total) - Number(inv.amountPaid);
      if (outstanding <= 0.005) continue;
      invoicesInArrears += 1;
      unitsInArrears.add(inv.unitId);
      totalOutstanding += outstanding;
      const days = Math.floor((now - new Date(inv.dueDate).getTime()) / 86_400_000);
      const key: ArrearsAgingBucket['bucket'] =
        days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      buckets[key].amount += outstanding;
      buckets[key].count += 1;
    }
    return {
      buckets: (Object.keys(buckets) as ArrearsAgingBucket['bucket'][]).map((bucket) => ({
        bucket,
        amount: Math.round(buckets[bucket].amount * 100) / 100,
        count: buckets[bucket].count,
      })),
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      unitsInArrears: unitsInArrears.size,
      invoicesInArrears,
    };
  }

  async unitStatementForUser(user: AuthenticatedUser, unitId: string): Promise<UnitStatement> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    const isManagement = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        ((r.roleId === RoleId.MANAGEMENT_ADMIN || r.roleId === RoleId.MANAGEMENT_STAFF) &&
          r.condoId === unit.condoId),
    );
    const isUnitMember = user.roles.some((r) => r.unitId === unitId);
    if (!isManagement && !isUnitMember) {
      throw new ForbiddenException('You cannot view this unit statement');
    }
    return this.unitStatement(unitId);
  }

  async unitStatement(unitId: string): Promise<UnitStatement> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { unitId, type: { not: LedgerEntryType.DEPOSIT } },
      orderBy: { occurredAt: 'asc' },
    });
    const account = await this.prisma.unitAccount.findUnique({ where: { unitId } });

    let balance = 0;
    const statementEntries: UnitStatementEntry[] = [];
    for (const e of entries) {
      const amount = Number(e.amount);
      const isCharge = e.type === LedgerEntryType.CHARGE;
      const charge = isCharge ? amount : 0;
      const payment = isCharge ? 0 : amount;
      balance += charge - payment;
      statementEntries.push({
        occurredAt: e.occurredAt.toISOString(),
        type: e.type,
        fund: e.fund,
        description: e.memo ?? e.type,
        charge,
        payment,
        balance: Math.round(balance * 100) / 100,
      });
    }

    return {
      unitId,
      creditBalance: Number(account?.creditBalance ?? 0),
      totalOutstanding: Math.round(balance * 100) / 100,
      entries: statementEntries,
    };
  }
}
