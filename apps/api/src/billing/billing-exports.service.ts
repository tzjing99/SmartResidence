import { isManagementForCondo } from '@/announcement/announcement-audience';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleId } from '@prisma/client';
import {
  ARREARS_BUCKET_LABELS,
  FUND_LABELS,
  type LedgerFund,
  formatCompactUnitLabel,
  formatMoney,
} from '@smartresidence/shared-types';
import { buildBalanceSheetPdf } from './balance-sheet-pdf';
import { buildCsv } from './csv-utils';
import { buildFundSummaryPdf } from './fund-summary-pdf';
import { LedgerService } from './ledger.service';
import { buildProfitLossPdf } from './profit-loss-pdf';
import { parseReceiptTemplate } from './receipt-template';
import { buildUnitStatementPdf } from './statement-pdf';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const fromDate = from ? startOfDay(new Date(from)) : startOfMonth(now);
  const toDate = to ? endOfDay(new Date(to)) : endOfDay(now);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new BadRequestException('Invalid date range');
  }
  if (fromDate > toDate) {
    throw new BadRequestException('from must be on or before to');
  }
  return { from: fromDate, to: toDate };
}

function parseAsOf(asOf?: string): Date {
  const date = asOf ? endOfDay(new Date(asOf)) : endOfDay(new Date());
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid asOf date');
  }
  return date;
}

function parseFundFilter(fund?: string): LedgerFund | undefined {
  if (!fund) return undefined;
  const allowed = ['MAINTENANCE', 'SINKING_FUND', 'DEPOSIT', 'GENERAL'] as const;
  if (!(allowed as readonly string[]).includes(fund)) {
    throw new BadRequestException(`Invalid fund: ${fund}`);
  }
  return fund as LedgerFund;
}

function formatExportDate(d: Date): string {
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Injectable()
export class BillingExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private assertManagement(user: AuthenticatedUser, condoId: string): void {
    const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (isSuperAdmin || isManagementForCondo(user, condoId)) return;
    throw new ForbiddenException('Management access required');
  }

  private async loadCondoTemplate(condoId: string) {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return { condo, template: parseReceiptTemplate(condo.settings) };
  }

  async unitStatementPdf(
    user: AuthenticatedUser,
    condoId: string,
    unitId: string,
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { block: true },
    });
    if (!unit || unit.condoId !== condoId) {
      throw new NotFoundException('Unit not found in this condo');
    }

    const { condo, template } = await this.loadCondoTemplate(condoId);
    const statement = await this.ledger.unitStatementInRange(unitId, range.from, range.to);
    const safeUnit = formatCompactUnitLabel(unit).replace(/[^\w.-]+/g, '-');
    const filename = `statement-${safeUnit}-${range.from.toISOString().slice(0, 10)}.pdf`;

    const buffer = buildUnitStatementPdf({
      organizationName: template.organizationName || condo.name,
      registrationNo: template.registrationNo || undefined,
      unitLabel: formatCompactUnitLabel(unit),
      periodFrom: formatExportDate(range.from),
      periodTo: formatExportDate(range.to),
      openingBalance: statement.openingBalance,
      closingBalance: statement.closingBalance,
      creditBalance: statement.creditBalance,
      entries: statement.entries,
    });

    return { buffer, filename };
  }

  async collectionsCsv(
    user: AuthenticatedUser,
    condoId: string,
    from?: string,
    to?: string,
  ): Promise<{ csv: string; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    await this.loadCondoTemplate(condoId);

    const [summary, rows] = await Promise.all([
      this.ledger.collectionsSummary(condoId, range.from, range.to),
      this.ledger.collectionsExportRows(condoId, range.from, range.to),
    ]);

    const csvRows: string[][] = [
      ['Collections export'],
      ['From', formatExportDate(range.from)],
      ['To', formatExportDate(range.to)],
      ['Total collected', formatMoney(summary.total)],
      ['Payment count', String(summary.count)],
      [],
      ['Fund', 'Amount'],
      ...summary.byFund.map((f) => [FUND_LABELS[f.fund], formatMoney(f.balance)]),
      [],
      ['Date', 'Unit', 'Fund', 'Type', 'Description', 'Amount', 'Source ref'],
      ...rows.map((r) => [
        formatExportDate(new Date(r.occurredAt)),
        r.unitLabel,
        FUND_LABELS[r.fund],
        r.type,
        r.description,
        formatMoney(r.amount),
        r.sourceRef ?? '',
      ]),
    ];

    const filename = `collections-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    return { csv: buildCsv(csvRows), filename };
  }

  async arrearsCsv(
    user: AuthenticatedUser,
    condoId: string,
  ): Promise<{ csv: string; filename: string }> {
    this.assertManagement(user, condoId);
    await this.loadCondoTemplate(condoId);

    const [aging, rows] = await Promise.all([
      this.ledger.arrearsAging(condoId),
      this.ledger.arrearsExportRows(condoId),
    ]);

    const csvRows: string[][] = [
      ['Arrears aging export'],
      ['Total outstanding', formatMoney(aging.totalOutstanding)],
      ['Units in arrears', String(aging.unitsInArrears)],
      ['Invoices in arrears', String(aging.invoicesInArrears ?? 0)],
      [],
      ['Age bucket', 'Invoice count', 'Amount'],
      ...aging.buckets.map((b) => [
        ARREARS_BUCKET_LABELS[b.bucket],
        String(b.count),
        formatMoney(b.amount),
      ]),
      [],
      [
        'Unit',
        'Invoice',
        'Due date',
        'Days overdue',
        'Age bucket',
        'Invoice total',
        'Amount paid',
        'Outstanding',
      ],
      ...rows.map((r) => [
        r.unitLabel,
        r.invoiceNumber,
        formatExportDate(new Date(r.dueDate)),
        String(r.daysOverdue),
        ARREARS_BUCKET_LABELS[r.bucket],
        formatMoney(r.total),
        formatMoney(r.amountPaid),
        formatMoney(r.outstanding),
      ]),
    ];

    const date = new Date().toISOString().slice(0, 10);
    return { csv: buildCsv(csvRows), filename: `arrears-aging-${date}.csv` };
  }

  async fundSummaryPdf(
    user: AuthenticatedUser,
    condoId: string,
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    const { condo, template } = await this.loadCondoTemplate(condoId);
    const report = await this.ledger.fundSummary(condoId, range.from, range.to);
    const filename = `fund-summary-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.pdf`;
    const buffer = buildFundSummaryPdf({
      organizationName: template.organizationName || condo.name,
      registrationNo: template.registrationNo || undefined,
      report,
    });
    return { buffer, filename };
  }

  async auditTrailCsv(
    user: AuthenticatedUser,
    condoId: string,
    from?: string,
    to?: string,
  ): Promise<{ csv: string; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    await this.loadCondoTemplate(condoId);

    const rows = await this.ledger.auditTrailExportRows(condoId, range.from, range.to);
    const csvRows: string[][] = [
      ['Ledger audit trail'],
      ['From', formatExportDate(range.from)],
      ['To', formatExportDate(range.to)],
      ['Entry count', String(rows.length)],
      [],
      [
        'Date',
        'Fund',
        'Type',
        'Amount',
        'Description',
        'Source type',
        'Source id',
        'Idempotency key',
        'Reversal of key',
        'User',
        'Entry id',
      ],
      ...rows.map((r) => [
        formatExportDate(new Date(r.occurredAt)),
        FUND_LABELS[r.fund],
        r.type,
        formatMoney(r.amount),
        r.memo ?? '',
        r.sourceType,
        r.sourceId ?? '',
        r.idempotencyKey ?? '',
        r.reversalOfIdempotencyKey ?? '',
        r.createdByName ?? '',
        r.id,
      ]),
    ];

    const filename = `audit-trail-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    return { csv: buildCsv(csvRows), filename };
  }

  async profitLossPdf(
    user: AuthenticatedUser,
    condoId: string,
    from?: string,
    to?: string,
    fund?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    const fundFilter = parseFundFilter(fund);
    const { condo, template } = await this.loadCondoTemplate(condoId);
    const report = await this.ledger.profitLoss(condoId, range.from, range.to, fundFilter);
    const fundSlug = fundFilter ? `-${fundFilter.toLowerCase()}` : '';
    const filename = `profit-loss${fundSlug}-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.pdf`;
    const buffer = buildProfitLossPdf({
      organizationName: template.organizationName || condo.name,
      registrationNo: template.registrationNo || undefined,
      report,
    });
    return { buffer, filename };
  }

  async profitLossCsv(
    user: AuthenticatedUser,
    condoId: string,
    from?: string,
    to?: string,
    fund?: string,
  ): Promise<{ csv: string; filename: string }> {
    this.assertManagement(user, condoId);
    const range = parseDateRange(from, to);
    const fundFilter = parseFundFilter(fund);
    await this.loadCondoTemplate(condoId);
    const report = await this.ledger.profitLoss(condoId, range.from, range.to, fundFilter);

    const csvRows: string[][] = [
      ['Profit and loss (income statement)'],
      ['From', formatExportDate(range.from)],
      ['To', formatExportDate(range.to)],
      ['Fund', report.fundLabel],
      [],
      ['Income'],
      ['Description', 'Code', 'Amount (MYR)'],
      ...report.income.lines.map((l) => [l.label, l.code ?? '', formatMoney(l.amount)]),
      ['Total income', '', formatMoney(report.income.total)],
      [],
      ['Expenditure'],
      ['Description', 'Code', 'Amount (MYR)'],
      ...report.expenses.lines.map((l) => [l.label, l.code ?? '', formatMoney(l.amount)]),
      ['Total expenditure', '', formatMoney(report.expenses.total)],
      [],
      ['Net surplus / (deficit)', '', formatMoney(report.netSurplus)],
    ];

    const fundSlug = fundFilter ? `-${fundFilter.toLowerCase()}` : '';
    const filename = `profit-loss${fundSlug}-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    return { csv: buildCsv(csvRows), filename };
  }

  async balanceSheetPdf(
    user: AuthenticatedUser,
    condoId: string,
    asOf?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    this.assertManagement(user, condoId);
    const date = parseAsOf(asOf);
    const { condo, template } = await this.loadCondoTemplate(condoId);
    const report = await this.ledger.balanceSheet(condoId, date);
    const filename = `balance-sheet-${date.toISOString().slice(0, 10)}.pdf`;
    const buffer = buildBalanceSheetPdf({
      organizationName: template.organizationName || condo.name,
      registrationNo: template.registrationNo || undefined,
      report,
    });
    return { buffer, filename };
  }

  async balanceSheetCsv(
    user: AuthenticatedUser,
    condoId: string,
    asOf?: string,
  ): Promise<{ csv: string; filename: string }> {
    this.assertManagement(user, condoId);
    const date = parseAsOf(asOf);
    await this.loadCondoTemplate(condoId);
    const report = await this.ledger.balanceSheet(condoId, date);

    const sectionRows = (
      title: string,
      lines: { label: string; amount: number }[],
      total: number,
    ) => [
      [title],
      ['Description', 'Amount (MYR)'],
      ...lines.map((l) => [l.label, formatMoney(l.amount)]),
      [`Total ${title.toLowerCase()}`, formatMoney(total)],
      [],
    ];

    const csvRows: string[][] = [
      ['Balance sheet'],
      ['As at', formatExportDate(date)],
      [],
      ...sectionRows('Assets', report.assets.lines, report.assets.total),
      ...sectionRows('Liabilities', report.liabilities.lines, report.liabilities.total),
      ...sectionRows('Funds', report.funds.lines, report.funds.total),
      ['Total assets', formatMoney(report.totalAssets)],
      ['Total liabilities and funds', formatMoney(report.totalLiabilitiesAndFunds)],
    ];

    const filename = `balance-sheet-${date.toISOString().slice(0, 10)}.csv`;
    return { csv: buildCsv(csvRows), filename };
  }
}
