/** Unit account statement PDF via the shared layout engine. */
import {
  FUND_LABELS,
  type LedgerEntryType,
  type LedgerFund,
  type UnitStatementEntry,
  formatCompactUnitLabel,
  formatMoney,
} from '@smartresidence/shared-types';
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

export interface UnitStatementPdfData {
  organizationName: string;
  registrationNo?: string;
  unitLabel: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  closingBalance: number;
  creditBalance: number;
  entries: UnitStatementEntry[];
}

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  CHARGE: 'Charge',
  PAYMENT: 'Payment',
  DEPOSIT: 'Deposit',
  REFUND: 'Refund',
  PREPAYMENT: 'Prepayment',
  PREPAYMENT_APPLIED: 'Credit applied',
  ADJUSTMENT: 'Adjustment',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtMoney(amount: number): string {
  return amount === 0 ? '—' : formatMoney(amount);
}

/** Build a multi-page A4 unit statement with running balance. */
export function buildUnitStatementPdf(data: UnitStatementPdfData): Buffer {
  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'Unit Statement',
      title: 'Account Statement',
      subtitle: data.unitLabel,
    },
    footerNote: data.registrationNo ? `Reg. ${data.registrationNo}` : undefined,
  });

  doc.labelValue('Unit', data.unitLabel);
  doc.labelValue('Period', `${data.periodFrom} — ${data.periodTo}`);
  doc.labelValue('Opening balance', formatMoney(data.openingBalance));
  doc.labelValue('Advance credit', formatMoney(data.creditBalance));

  doc.sectionTitle('Transactions');

  if (data.entries.length === 0) {
    doc.paragraph('No transactions in this period.', { color: PDF_COLORS.muted });
  } else {
    doc.table({
      columns: [
        { header: 'Date', width: 0.14 },
        { header: 'Description', width: 0.36 },
        { header: 'Charge', width: 0.14, align: 'right' },
        { header: 'Payment', width: 0.14, align: 'right' },
        { header: 'Balance', width: 0.14, align: 'right', bold: true },
      ],
      rows: data.entries.map((e) => [
        fmtDate(e.occurredAt),
        `${e.description} (${FUND_LABELS[e.fund as LedgerFund]} · ${ENTRY_TYPE_LABELS[e.type]})`,
        fmtMoney(e.charge),
        fmtMoney(e.payment),
        formatMoney(e.balance),
      ]),
    });
  }

  doc.spacer(8);
  doc.totals([
    { label: 'Opening balance', value: formatMoney(data.openingBalance) },
    {
      label: 'Closing balance',
      value: formatMoney(data.closingBalance),
      emphasize: true,
    },
  ]);

  return doc.build();
}

export { formatCompactUnitLabel };
