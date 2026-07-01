import {
  type LedgerFund,
  type ProfitLossReport,
  STATEMENT_FUND_LABELS,
  formatMoney,
} from '@smartresidence/shared-types';
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

export interface ProfitLossPdfData {
  organizationName: string;
  registrationNo?: string;
  report: ProfitLossReport;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sectionTable(
  doc: PdfDocument,
  section: ProfitLossReport['income'],
  emphasizeTotal = false,
): void {
  if (section.lines.length === 0) {
    doc.paragraph('No entries in this period.', { color: PDF_COLORS.muted });
    return;
  }
  doc.table({
    columns: [
      { header: 'Description', width: 0.62 },
      { header: 'Amount (MYR)', width: 0.38, align: 'right' },
    ],
    rows: [
      ...section.lines.map((line) => [line.label, formatMoney(line.amount)]),
      [
        emphasizeTotal ? `Total ${section.title.toLowerCase()}` : 'Subtotal',
        formatMoney(section.total),
      ],
    ],
  });
}

/** Build an AGM-ready profit & loss (income statement) PDF. */
export function buildProfitLossPdf(data: ProfitLossPdfData): Buffer {
  const { report } = data;
  const fundNote =
    report.fund === 'ALL'
      ? 'All funds (consolidated)'
      : STATEMENT_FUND_LABELS[report.fund as LedgerFund];

  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'Financial statements',
      title: 'Statement of Income and Expenditure',
      subtitle: `${fmtDate(report.from)} — ${fmtDate(report.to)} · ${fundNote}`,
    },
    footerNote: data.registrationNo ? `Reg. ${data.registrationNo}` : undefined,
  });

  doc.paragraph(
    'Income reflects collections and other receipts; expenditure reflects charges issued by fee category for the period. Amounts are derived from the audited ledger.',
    { color: PDF_COLORS.muted },
  );

  doc.sectionTitle('Income');
  sectionTable(doc, report.income);

  doc.spacer(6);
  doc.sectionTitle('Expenditure');
  sectionTable(doc, report.expenses, true);

  doc.spacer(8);
  doc.totals([
    {
      label: 'Total income',
      value: formatMoney(report.income.total),
    },
    {
      label: 'Total expenditure',
      value: formatMoney(report.expenses.total),
    },
    {
      label: report.netSurplus >= 0 ? 'Surplus for the period' : 'Deficit for the period',
      value: formatMoney(Math.abs(report.netSurplus)),
      emphasize: true,
    },
  ]);

  doc.spacer(16);
  doc.paragraph('Prepared for audit — sign below when reviewed.', { color: PDF_COLORS.muted });
  doc.signature(undefined, 'Auditor / Management signatory');

  return doc.build();
}
