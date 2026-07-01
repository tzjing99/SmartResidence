import { type BalanceSheetReport, formatMoney } from '@smartresidence/shared-types';
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

export interface BalanceSheetPdfData {
  organizationName: string;
  registrationNo?: string;
  report: BalanceSheetReport;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sectionTable(doc: PdfDocument, section: BalanceSheetReport['assets']): void {
  if (section.lines.length === 0) {
    doc.paragraph('None.', { color: PDF_COLORS.muted });
    return;
  }
  doc.table({
    columns: [
      { header: 'Description', width: 0.62 },
      { header: 'Amount (MYR)', width: 0.38, align: 'right' },
    ],
    rows: [
      ...section.lines.map((line) => [line.label, formatMoney(line.amount)]),
      [`Total ${section.title.toLowerCase()}`, formatMoney(section.total)],
    ],
  });
}

/** Build an AGM-ready balance sheet PDF as at a single date. */
export function buildBalanceSheetPdf(data: BalanceSheetPdfData): Buffer {
  const { report } = data;

  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'Financial statements',
      title: 'Balance Sheet',
      subtitle: `As at ${fmtDate(report.asOf)}`,
    },
    footerNote: data.registrationNo ? `Reg. ${data.registrationNo}` : undefined,
  });

  doc.paragraph(
    'Assets include fund cash balances and amounts due from proprietors. Liabilities include deposits held on behalf of units. Fund balances represent maintenance, sinking, and general reserves under the Strata Management Act.',
    { color: PDF_COLORS.muted },
  );

  doc.sectionTitle('Assets');
  sectionTable(doc, report.assets);

  doc.spacer(6);
  doc.sectionTitle('Liabilities');
  sectionTable(doc, report.liabilities);

  doc.spacer(6);
  doc.sectionTitle('Funds (equity)');
  sectionTable(doc, report.funds);

  doc.spacer(8);
  doc.totals([
    { label: 'Total assets', value: formatMoney(report.totalAssets), emphasize: true },
    {
      label: 'Total liabilities and funds',
      value: formatMoney(report.totalLiabilitiesAndFunds),
      emphasize: true,
    },
  ]);

  doc.spacer(16);
  doc.paragraph('Prepared for audit — sign below when reviewed.', { color: PDF_COLORS.muted });
  doc.signature(undefined, 'Auditor / Management signatory');

  return doc.build();
}
