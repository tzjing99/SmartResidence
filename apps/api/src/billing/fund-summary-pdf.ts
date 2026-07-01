import {
  FUND_LABELS,
  type FundSummaryReport,
  type LedgerFund,
  formatMoney,
} from '@smartresidence/shared-types';
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

export interface FundSummaryPdfData {
  organizationName: string;
  registrationNo?: string;
  report: FundSummaryReport;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Build a multi-page A4 fund summary for AGM / auditor handout. */
export function buildFundSummaryPdf(data: FundSummaryPdfData): Buffer {
  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'Fund summary',
      title: 'Fund Summary Report',
      subtitle: `${fmtDate(data.report.from)} — ${fmtDate(data.report.to)}`,
    },
    footerNote: data.registrationNo ? `Reg. ${data.registrationNo}` : undefined,
  });

  doc.paragraph(
    'Cash balances are kept separate by fund type (maintenance account, sinking fund, deposits held, general). Charges billed to units are shown for reference; fund cash reflects collections and adjustments only.',
    { color: PDF_COLORS.muted },
  );

  doc.sectionTitle('Balances by fund');

  doc.table({
    columns: [
      { header: 'Fund', width: 0.22 },
      { header: 'Opening', width: 0.13, align: 'right' },
      { header: 'Collected', width: 0.13, align: 'right' },
      { header: 'Charged', width: 0.13, align: 'right' },
      { header: 'Adjustments', width: 0.13, align: 'right' },
      { header: 'Closing', width: 0.14, align: 'right', bold: true },
    ],
    rows: data.report.funds.map((row) => [
      FUND_LABELS[row.fund as LedgerFund],
      formatMoney(row.openingBalance),
      formatMoney(row.collections),
      formatMoney(row.chargesIssued),
      formatMoney(row.adjustments),
      formatMoney(row.closingBalance),
    ]),
  });

  doc.spacer(8);
  doc.totals(
    data.report.funds.map((row) => ({
      label: `${FUND_LABELS[row.fund as LedgerFund]} closing`,
      value: formatMoney(row.closingBalance),
      emphasize: row.fund === 'MAINTENANCE' || row.fund === 'SINKING_FUND',
    })),
  );

  return doc.build();
}
