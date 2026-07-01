import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BankReconciliationWorksheet } from '@smartresidence/shared-types';
import { CoaService } from './coa.service';
import { GlService } from './gl.service';

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coa: CoaService,
    private readonly gl: GlService,
  ) {}

  async importCsv(
    user: AuthenticatedUser,
    condoId: string,
    input: {
      accountId: string;
      periodStart: string;
      periodEnd: string;
      openingBalance: number;
      closingBalance: number;
      csv: string;
    },
  ) {
    await this.coa.ensureSeeded(this.prisma, condoId);
    const account = await this.prisma.glAccount.findFirst({
      where: { id: input.accountId, condoId, type: 'ASSET' },
    });
    if (!account) throw new NotFoundException('Bank GL account not found');

    const parsed = parseBankCsv(input.csv);
    if (parsed.length === 0) throw new BadRequestException('No valid rows in CSV');

    return this.prisma.bankStatementImport.create({
      data: {
        condoId,
        accountId: input.accountId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        openingBalance: input.openingBalance,
        closingBalance: input.closingBalance,
        importedByUserId: user.id,
        lines: {
          create: parsed.map((row) => ({
            date: row.date,
            description: row.description,
            amount: row.amount,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async listImports(condoId: string, accountId?: string) {
    return this.prisma.bankStatementImport.findMany({
      where: { condoId, ...(accountId ? { accountId } : {}) },
      orderBy: { importedAt: 'desc' },
      include: {
        account: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async matchLine(condoId: string, lineId: string, journalLineId: string | null) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, import: { condoId } },
    });
    if (!line) throw new NotFoundException('Statement line not found');

    if (journalLineId) {
      const jl = await this.prisma.glJournalLine.findFirst({
        where: { id: journalLineId, journalEntry: { condoId } },
      });
      if (!jl) throw new NotFoundException('Journal line not found');
    }

    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { matchedJournalLineId: journalLineId },
    });
  }

  async worksheet(condoId: string, importId: string): Promise<BankReconciliationWorksheet> {
    const imp = await this.prisma.bankStatementImport.findFirst({
      where: { id: importId, condoId },
      include: {
        account: { select: { id: true, code: true, name: true, fund: true } },
        lines: {
          include: {
            matchedJournalLine: {
              include: {
                journalEntry: { select: { id: true, description: true, entryDate: true } },
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });
    if (!imp) throw new NotFoundException('Bank import not found');

    const glLines = await this.gl.cashLinesForAccount(
      condoId,
      imp.accountId,
      imp.periodStart,
      imp.periodEnd,
    );

    const matchedGlIds = new Set(
      imp.lines.map((l) => l.matchedJournalLineId).filter(Boolean) as string[],
    );

    const statementTotal = imp.lines.reduce((s, l) => s + Number(l.amount), 0);
    const matchedCount = imp.lines.filter((l) => l.matchedJournalLineId).length;

    return {
      import: {
        id: imp.id,
        periodStart: imp.periodStart.toISOString().slice(0, 10),
        periodEnd: imp.periodEnd.toISOString().slice(0, 10),
        openingBalance: Number(imp.openingBalance),
        closingBalance: Number(imp.closingBalance),
        importedAt: imp.importedAt.toISOString(),
        account: imp.account,
      },
      statementLines: imp.lines.map((l) => ({
        id: l.id,
        date: l.date.toISOString().slice(0, 10),
        description: l.description,
        amount: Number(l.amount),
        matchedJournalLineId: l.matchedJournalLineId,
        matchedJournal: l.matchedJournalLine
          ? {
              id: l.matchedJournalLine.id,
              debit: Number(l.matchedJournalLine.debit),
              credit: Number(l.matchedJournalLine.credit),
              entryDate: l.matchedJournalLine.journalEntry.entryDate.toISOString().slice(0, 10),
              entryDescription: l.matchedJournalLine.journalEntry.description,
            }
          : null,
      })),
      glLines: glLines.map((l) => ({
        id: l.id,
        entryDate: l.journalEntry.entryDate.toISOString().slice(0, 10),
        entryDescription: l.journalEntry.description,
        sourceType: l.journalEntry.sourceType,
        debit: Number(l.debit),
        credit: Number(l.credit),
        fund: l.fund,
        memo: l.memo,
        matched: matchedGlIds.has(l.id),
      })),
      summary: {
        statementLineCount: imp.lines.length,
        matchedCount,
        unmatchedStatementCount: imp.lines.length - matchedCount,
        unmatchedGlCount: glLines.filter((l) => !matchedGlIds.has(l.id)).length,
        statementMovement: Math.round(statementTotal * 100) / 100,
        glNetMovement:
          Math.round(glLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) * 100) /
          100,
      },
    };
  }
}

/** Parse bank CSV: date, description, amount (header row optional). */
export function parseBankCsv(
  csv: string,
): Array<{ date: Date; description: string; amount: number }> {
  const rows: Array<{ date: Date; description: string; amount: number }> = [];
  const lines = csv.trim().split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (cells.length < 3) continue;
    const dateCell = cells[0] ?? '';
    const descCell = cells[1] ?? '';
    const amountCell = cells[2] ?? '';
    // Skip header row
    if (i === 0 && /date|tarikh/i.test(dateCell)) continue;

    const date = parseDate(dateCell);
    if (!date) continue;
    const description = descCell.trim();
    const amount = parseAmount(amountCell);
    if (amount == null || !description) continue;
    rows.push({ date, description, amount });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1] ?? '';
    const m = dmy[2] ?? '';
    const y = dmy[3] ?? '';
    if (!d || !m || !y) return null;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\sRM]/gi, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
