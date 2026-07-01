import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { GlJournalSourceType, LedgerEntryType, LedgerFund, type Prisma } from '@prisma/client';
import { GL_AUTO_POST_CODES } from './coa-template';
import { CoaService } from './coa.service';
import { GlService, type JournalLineInput } from './gl.service';

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Mirrors operational ledger events (invoice charges, payments) into the
 * double-entry GL. Failures are logged but do not block billing — the
 * operational ledger remains the source of truth for resident balances.
 */
@Injectable()
export class GlPostingService {
  private readonly log = new Logger(GlPostingService.name);

  constructor(
    private readonly coa: CoaService,
    private readonly gl: GlService,
  ) {}

  async postInvoiceCharges(
    client: Client,
    opts: {
      invoiceId: string;
      condoId: string;
      number: string;
      issuedAt?: Date | null;
      lines: Array<{ code: string; amount: number; description: string }>;
      actorUserId?: string | null;
    },
  ) {
    try {
      await this.coa.ensureSeeded(client, opts.condoId);
      const accountMap = await this.accountCodes(client, opts.condoId);

      const byFund = new Map<LedgerFund, number>();
      for (const line of opts.lines) {
        const fund = fundOfCode(line.code);
        byFund.set(fund, (byFund.get(fund) ?? 0) + line.amount);
      }

      const journalLines: JournalLineInput[] = [];
      for (const [fund, amount] of byFund) {
        if (amount < 0.005) continue;
        const rounded = Math.round(amount * 100) / 100;
        const arCode = GL_AUTO_POST_CODES.receivable[fund];
        const incomeCode = GL_AUTO_POST_CODES.income[fund];
        const ar = accountMap.get(arCode);
        const income = accountMap.get(incomeCode);
        if (!ar || !income) continue;

        journalLines.push(
          { accountId: ar.id, debit: rounded, credit: 0, fund, memo: opts.number },
          { accountId: income.id, debit: 0, credit: rounded, fund, memo: opts.number },
        );
      }

      if (journalLines.length === 0) return;

      await this.gl.postEntry(client, {
        condoId: opts.condoId,
        entryDate: opts.issuedAt ?? new Date(),
        description: `Invoice ${opts.number} issued`,
        sourceType: GlJournalSourceType.INVOICE,
        sourceId: opts.invoiceId,
        postedByUserId: opts.actorUserId ?? null,
        idempotencyKey: `gl:invoice:${opts.invoiceId}`,
        lines: journalLines,
      });
    } catch (err) {
      this.log.warn(`GL post invoice ${opts.invoiceId} failed: ${(err as Error).message}`);
    }
  }

  async postPayment(
    client: Client,
    opts: {
      paymentId: string;
      invoiceId: string;
      condoId: string;
      invoiceNumber: string;
      allocations: Array<{ fund: LedgerFund; amount: number }>;
      occurredAt?: Date;
      actorUserId?: string | null;
    },
  ) {
    try {
      await this.coa.ensureSeeded(client, opts.condoId);
      const accountMap = await this.accountCodes(client, opts.condoId);

      const journalLines: JournalLineInput[] = [];
      for (const { fund, amount } of opts.allocations) {
        if (amount < 0.005) continue;
        const rounded = Math.round(amount * 100) / 100;
        const bankCode = GL_AUTO_POST_CODES.bank[fund];
        const arCode = GL_AUTO_POST_CODES.receivable[fund];
        const bank = accountMap.get(bankCode);
        const ar = accountMap.get(arCode);
        if (!bank || !ar) continue;

        journalLines.push(
          { accountId: bank.id, debit: rounded, credit: 0, fund, memo: opts.invoiceNumber },
          { accountId: ar.id, debit: 0, credit: rounded, fund, memo: opts.invoiceNumber },
        );
      }

      if (journalLines.length === 0) return;

      await this.gl.postEntry(client, {
        condoId: opts.condoId,
        entryDate: opts.occurredAt ?? new Date(),
        description: `Payment for ${opts.invoiceNumber}`,
        sourceType: GlJournalSourceType.PAYMENT,
        sourceId: opts.paymentId,
        postedByUserId: opts.actorUserId ?? null,
        idempotencyKey: `gl:payment:${opts.paymentId}`,
        lines: journalLines,
      });
    } catch (err) {
      this.log.warn(`GL post payment ${opts.paymentId} failed: ${(err as Error).message}`);
    }
  }

  async postLedgerEntry(
    client: Client,
    entry: {
      condoId: string;
      fund: LedgerFund;
      type: LedgerEntryType;
      amount: number;
      sourceType: string;
      sourceId?: string | null;
      memo?: string | null;
      occurredAt?: Date;
      createdByUserId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    if (entry.type === LedgerEntryType.CHARGE && entry.sourceType === 'Invoice') return;
    if (entry.type === LedgerEntryType.PAYMENT && entry.sourceType === 'Payment') return;

    // Deposits: Dr bank, Cr deposits held
    if (entry.type === LedgerEntryType.DEPOSIT) {
      await this.postDeposit(client, entry);
    }
  }

  private async postDeposit(
    client: Client,
    entry: {
      condoId: string;
      fund: LedgerFund;
      amount: number;
      sourceId?: string | null;
      memo?: string | null;
      occurredAt?: Date;
      createdByUserId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    try {
      await this.coa.ensureSeeded(client, entry.condoId);
      const accountMap = await this.accountCodes(client, entry.condoId);
      const bank = accountMap.get(GL_AUTO_POST_CODES.bank.DEPOSIT);
      const held = accountMap.get(GL_AUTO_POST_CODES.depositsHeld);
      if (!bank || !held) return;

      const amt = Math.round(entry.amount * 100) / 100;
      await this.gl.postEntry(client, {
        condoId: entry.condoId,
        entryDate: entry.occurredAt ?? new Date(),
        description: entry.memo ?? 'Deposit received',
        sourceType: GlJournalSourceType.PAYMENT,
        sourceId: entry.sourceId ?? null,
        postedByUserId: entry.createdByUserId ?? null,
        idempotencyKey: entry.idempotencyKey ? `gl:${entry.idempotencyKey}` : null,
        lines: [
          { accountId: bank.id, debit: amt, credit: 0, fund: LedgerFund.DEPOSIT, memo: entry.memo },
          { accountId: held.id, debit: 0, credit: amt, fund: LedgerFund.DEPOSIT, memo: entry.memo },
        ],
      });
    } catch (err) {
      this.log.warn(`GL post deposit failed: ${(err as Error).message}`);
    }
  }

  /** Accrue vendor bill: Dr expense, Cr accounts payable. */
  async postVendorBillApproved(
    client: Client,
    opts: {
      vendorBillId: string;
      condoId: string;
      billNumber: string;
      billDate: Date;
      amount: number;
      fund: LedgerFund;
      description?: string | null;
      actorUserId?: string | null;
    },
  ) {
    try {
      await this.coa.ensureSeeded(client, opts.condoId);
      const accountMap = await this.accountCodes(client, opts.condoId);
      const expenseCode =
        GL_AUTO_POST_CODES.expense[opts.fund] ?? GL_AUTO_POST_CODES.expense.GENERAL;
      const expense = accountMap.get(expenseCode);
      const payable = accountMap.get(GL_AUTO_POST_CODES.payable);
      if (!expense || !payable) return;

      const amt = Math.round(opts.amount * 100) / 100;
      const memo = opts.billNumber;
      await this.gl.postEntry(client, {
        condoId: opts.condoId,
        entryDate: opts.billDate,
        description: opts.description?.trim()
          ? `Vendor bill ${opts.billNumber}: ${opts.description.trim()}`
          : `Vendor bill ${opts.billNumber}`,
        sourceType: GlJournalSourceType.VENDOR_BILL,
        sourceId: opts.vendorBillId,
        postedByUserId: opts.actorUserId ?? null,
        idempotencyKey: `gl:vendor-bill:${opts.vendorBillId}`,
        lines: [
          { accountId: expense.id, debit: amt, credit: 0, fund: opts.fund, memo },
          { accountId: payable.id, debit: 0, credit: amt, fund: opts.fund, memo },
        ],
      });
    } catch (err) {
      this.log.warn(`GL post vendor bill ${opts.vendorBillId} failed: ${(err as Error).message}`);
    }
  }

  /** Pay vendor bill: Dr AP, Cr bank. Returns journal entry id when posted. */
  async postVendorBillPaid(
    client: Client,
    opts: {
      vendorBillId: string;
      condoId: string;
      billNumber: string;
      paidAt: Date;
      amount: number;
      fund: LedgerFund;
      actorUserId?: string | null;
    },
  ): Promise<string | null> {
    try {
      await this.coa.ensureSeeded(client, opts.condoId);
      const accountMap = await this.accountCodes(client, opts.condoId);
      const bankCode = GL_AUTO_POST_CODES.bank[opts.fund];
      const bank = accountMap.get(bankCode);
      const payable = accountMap.get(GL_AUTO_POST_CODES.payable);
      if (!bank || !payable) return null;

      const amt = Math.round(opts.amount * 100) / 100;
      const memo = opts.billNumber;
      const entry = await this.gl.postEntry(client, {
        condoId: opts.condoId,
        entryDate: opts.paidAt,
        description: `Vendor payment ${opts.billNumber}`,
        sourceType: GlJournalSourceType.VENDOR_PAYMENT,
        sourceId: opts.vendorBillId,
        postedByUserId: opts.actorUserId ?? null,
        idempotencyKey: `gl:vendor-payment:${opts.vendorBillId}`,
        lines: [
          { accountId: payable.id, debit: amt, credit: 0, fund: opts.fund, memo },
          { accountId: bank.id, debit: 0, credit: amt, fund: opts.fund, memo },
        ],
      });
      return entry.id;
    } catch (err) {
      this.log.warn(
        `GL post vendor payment ${opts.vendorBillId} failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async accountCodes(client: Client, condoId: string) {
    const rows = await client.glAccount.findMany({
      where: { condoId, active: true },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.code, r]));
  }
}

function fundOfCode(code: string): LedgerFund {
  const c = code.toUpperCase();
  if (c.includes('SINK')) return LedgerFund.SINKING_FUND;
  if (c.includes('MAINT')) return LedgerFund.MAINTENANCE;
  if (c.includes('DEPOSIT')) return LedgerFund.DEPOSIT;
  return LedgerFund.GENERAL;
}
