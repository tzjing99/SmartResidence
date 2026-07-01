import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GlJournalSourceType, LedgerFund, type Prisma } from '@prisma/client';
import type { GlJournalEntryDetail, GlJournalListItem } from '@smartresidence/shared-types';
import { CoaService, journalBalanced } from './coa.service';

type Client = PrismaService | Prisma.TransactionClient;

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  fund: LedgerFund;
  memo?: string | null;
}

@Injectable()
export class GlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coa: CoaService,
  ) {}

  async listJournals(
    condoId: string,
    opts: { from?: string; to?: string; limit?: number } = {},
  ): Promise<GlJournalListItem[]> {
    await this.coa.ensureSeeded(this.prisma, condoId);
    const where: Prisma.GlJournalEntryWhereInput = { condoId };
    if (opts.from || opts.to) {
      where.entryDate = {};
      if (opts.from) where.entryDate.gte = new Date(opts.from);
      if (opts.to) where.entryDate.lte = new Date(opts.to);
    }
    const rows = await this.prisma.glJournalEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: opts.limit ?? 100,
      include: {
        lines: { select: { debit: true, credit: true } },
        postedBy: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      entryDate: r.entryDate.toISOString().slice(0, 10),
      description: r.description,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      postedBy: r.postedBy,
      totalDebit: r.lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: r.lines.reduce((s, l) => s + Number(l.credit), 0),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getJournal(condoId: string, entryId: string): Promise<GlJournalEntryDetail> {
    const entry = await this.prisma.glJournalEntry.findFirst({
      where: { id: entryId, condoId },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { debit: 'desc' },
        },
        postedBy: { select: { id: true, name: true } },
      },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return {
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      description: entry.description,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      postedBy: entry.postedBy,
      lines: entry.lines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
        fund: l.fund,
        memo: l.memo,
      })),
      createdAt: entry.createdAt.toISOString(),
    };
  }

  /** Post a manual balanced journal entry. */
  async postManual(
    user: AuthenticatedUser,
    condoId: string,
    input: {
      entryDate: string;
      description: string;
      lines: JournalLineInput[];
      idempotencyKey?: string;
    },
  ) {
    return this.postEntry(this.prisma, {
      condoId,
      entryDate: new Date(input.entryDate),
      description: input.description,
      sourceType: GlJournalSourceType.MANUAL,
      postedByUserId: user.id,
      idempotencyKey: input.idempotencyKey ?? null,
      lines: input.lines,
    });
  }

  /** Core posting — validates balance and writes entry + lines atomically. */
  async postEntry(
    client: Client,
    opts: {
      condoId: string;
      entryDate: Date;
      description: string;
      sourceType: GlJournalSourceType;
      sourceId?: string | null;
      postedByUserId?: string | null;
      idempotencyKey?: string | null;
      lines: JournalLineInput[];
    },
  ) {
    await this.coa.ensureSeeded(client, opts.condoId);

    if (opts.idempotencyKey) {
      const existing = await client.glJournalEntry.findUnique({
        where: { idempotencyKey: opts.idempotencyKey },
        include: { lines: true },
      });
      if (existing) return existing;
    }

    const normalized = opts.lines
      .filter((l) => Math.abs(l.debit) >= 0.005 || Math.abs(l.credit) >= 0.005)
      .map((l) => ({
        accountId: l.accountId,
        debit: Math.round(l.debit * 100) / 100,
        credit: Math.round(l.credit * 100) / 100,
        fund: l.fund,
        memo: l.memo ?? null,
      }));

    if (normalized.length < 2) {
      throw new BadRequestException('A journal entry needs at least two lines');
    }
    if (!journalBalanced(normalized)) {
      throw new BadRequestException('Debits must equal credits');
    }

    return client.glJournalEntry.create({
      data: {
        condoId: opts.condoId,
        entryDate: opts.entryDate,
        description: opts.description,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId ?? null,
        postedByUserId: opts.postedByUserId ?? null,
        idempotencyKey: opts.idempotencyKey ?? null,
        lines: { create: normalized },
      },
      include: { lines: true },
    });
  }

  /** GL cash-account lines in a period (for bank recon worksheet). */
  async cashLinesForAccount(condoId: string, accountId: string, from: Date, to: Date) {
    return this.prisma.glJournalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          condoId,
          entryDate: { gte: from, lte: to },
        },
      },
      include: {
        journalEntry: {
          select: {
            id: true,
            entryDate: true,
            description: true,
            sourceType: true,
          },
        },
      },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }],
    });
  }
}
