import {
  COB_TEMPLATE_LABEL,
  FUND_LABELS,
  type CobTemplateKind,
  formatMoney,
  type LedgerFund,
} from '@smartresidence/shared-types';
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';
import type { CobPrefillContext } from './cob-prefill';

const DISCLAIMER =
  'This document is a pre-filled aid only. Verify all entries against your strata records and COB requirements before submission. SmartResidence does not provide legal advice.';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function createCobDoc(ctx: CobPrefillContext, title: string, subtitle?: string): PdfDocument {
  return new PdfDocument({
    header: {
      brand: ctx.organizationName,
      title,
      subtitle,
    },
    footerNote: ctx.registrationNo ? `Reg. ${ctx.registrationNo}` : undefined,
    footerCaption: 'COB filing aid — not legal advice',
  });
}

function addDisclaimer(doc: PdfDocument): void {
  doc.spacer(12);
  doc.paragraph(DISCLAIMER, { size: 8, color: PDF_COLORS.muted });
}

function addBuildingBlock(doc: PdfDocument, ctx: CobPrefillContext): void {
  doc.sectionTitle('Building particulars');
  doc.labelValue('Development name', ctx.organizationName);
  if (ctx.registrationNo) doc.labelValue('Registration no.', ctx.registrationNo);
  doc.labelValue('Address', ctx.address);
  doc.labelValue('Blocks', String(ctx.blockCount));
  doc.labelValue('Parcels / units', String(ctx.unitCount));
  doc.labelValue('Data as at', fmtDate(ctx.asAtDate));
}

function addMcTable(doc: PdfDocument, ctx: CobPrefillContext): void {
  doc.sectionTitle('Management committee');
  if (ctx.managementCommittee.length === 0) {
    doc.paragraph('No management admin users assigned — add roles under Admin → Settings → Roles.', {
      color: PDF_COLORS.muted,
    });
    return;
  }
  doc.table({
    columns: [
      { header: 'Name', width: 0.35 },
      { header: 'Role', width: 0.35 },
      { header: 'Contact', width: 0.3 },
    ],
    rows: ctx.managementCommittee.map((m) => [m.name, m.role, m.email ?? '—']),
  });
}

function addFundBalances(doc: PdfDocument, ctx: CobPrefillContext): void {
  doc.sectionTitle('Fund balances (cash)');
  doc.paragraph(
    'Balances exclude charges billed but not yet collected. Export the fund summary PDF from Accounting for full period movement.',
    { size: 9, color: PDF_COLORS.muted },
  );
  doc.table({
    columns: [
      { header: 'Fund', width: 0.55 },
      { header: 'Balance (MYR)', width: 0.45, align: 'right' },
    ],
    rows: ctx.fundBalances.map((f) => [f.label, f.balanceFormatted]),
  });
}

export function buildCobTemplatePdf(kind: CobTemplateKind, ctx: CobPrefillContext): Buffer {
  switch (kind) {
    case 'ANNUAL_RETURN':
      return buildAnnualReturnPdf(ctx);
    case 'FINANCIAL_SUMMARY':
      return buildFinancialSummaryPdf(ctx);
    case 'MEETING_MINUTES_COVER':
      return buildMeetingMinutesCoverPdf(ctx);
    case 'INSURANCE_REGISTER':
      return buildInsuranceRegisterPdf(ctx);
    default:
      return buildAnnualReturnPdf(ctx);
  }
}

function buildAnnualReturnPdf(ctx: CobPrefillContext): Buffer {
  const doc = createCobDoc(ctx, COB_TEMPLATE_LABEL.ANNUAL_RETURN, 'Commissioner of Buildings filing aid');
  addBuildingBlock(doc, ctx);
  addMcTable(doc, ctx);
  doc.sectionTitle('Annual return checklist');
  doc.paragraph('• Confirm parcel schedule matches COB registered strata plan');
  doc.paragraph('• Attach audited or management accounts showing separate maintenance & sinking balances');
  doc.paragraph('• Include minutes of the latest AGM');
  doc.paragraph('• Retain bank statements and insurance certificates in your document vault');
  addDisclaimer(doc);
  return doc.build();
}

function buildFinancialSummaryPdf(ctx: CobPrefillContext): Buffer {
  const periodLabel =
    ctx.reportingFrom && ctx.reportingTo
      ? `${fmtDate(ctx.reportingFrom)} — ${fmtDate(ctx.reportingTo)}`
      : undefined;
  const doc = createCobDoc(
    ctx,
    COB_TEMPLATE_LABEL.FINANCIAL_SUMMARY,
    periodLabel ?? 'Financial summary',
  );
  addBuildingBlock(doc, ctx);
  addFundBalances(doc, ctx);

  if (ctx.fundSummaryRows.length > 0) {
    doc.sectionTitle('Period movement by fund');
    doc.table({
      columns: [
        { header: 'Fund', width: 0.2 },
        { header: 'Opening', width: 0.13, align: 'right' },
        { header: 'Collected', width: 0.14, align: 'right' },
        { header: 'Charged', width: 0.14, align: 'right' },
        { header: 'Adjustments', width: 0.14, align: 'right' },
        { header: 'Closing', width: 0.15, align: 'right', bold: true },
      ],
      rows: ctx.fundSummaryRows.map((row) => [
        FUND_LABELS[row.fund as LedgerFund],
        formatMoney(row.openingBalance),
        formatMoney(row.collections),
        formatMoney(row.chargesIssued),
        formatMoney(row.adjustments),
        formatMoney(row.closingBalance),
      ]),
    });
  }

  doc.sectionTitle('Supporting exports');
  doc.paragraph('• Fund summary PDF — Admin → Accounting → Export fund summary PDF');
  doc.paragraph('• Income vs expense report — Accounting dashboard for the same period');
  doc.paragraph('• Audit trail CSV — for ledger traceability');
  addDisclaimer(doc);
  return doc.build();
}

function buildMeetingMinutesCoverPdf(ctx: CobPrefillContext): Buffer {
  const doc = createCobDoc(ctx, COB_TEMPLATE_LABEL.MEETING_MINUTES_COVER, 'Minutes submission cover');
  addBuildingBlock(doc, ctx);
  doc.sectionTitle('Meeting details (complete before filing)');
  doc.labelValue('Meeting type', '_________________________  (AGM / EGM / JMC)');
  doc.labelValue('Meeting date', '_________________________');
  doc.labelValue('Venue', '_________________________');
  doc.labelValue('Quorum met', '_________________________  (Yes / No)');
  doc.labelValue('Minutes prepared by', ctx.signatoryName ?? '_________________________');
  doc.labelValue('Position', ctx.signatoryTitle ?? '_________________________');
  doc.labelValue('Date of minutes', '_________________________');
  doc.sectionTitle('Resolutions summary');
  doc.paragraph('Attach full minutes from Admin → Governance. List key resolutions below:', {
    color: PDF_COLORS.muted,
  });
  for (let i = 1; i <= 5; i++) {
    doc.paragraph(`${i}. ________________________________________________________________`);
  }
  addDisclaimer(doc);
  return doc.build();
}

function buildInsuranceRegisterPdf(ctx: CobPrefillContext): Buffer {
  const doc = createCobDoc(
    ctx,
    COB_TEMPLATE_LABEL.INSURANCE_REGISTER,
    'Policy & certificate register',
  );
  addBuildingBlock(doc, ctx);
  doc.sectionTitle('Insurance policies');
  doc.table({
    columns: [
      { header: 'Policy type', width: 0.18 },
      { header: 'Insurer', width: 0.18 },
      { header: 'Policy no.', width: 0.16 },
      { header: 'Sum insured', width: 0.14, align: 'right' },
      { header: 'Period', width: 0.18 },
      { header: 'Renewal', width: 0.16 },
    ],
    rows: [
      ['Fire / MR', '', '', '', '', ''],
      ['Public liability', '', '', '', '', ''],
      ['All risks / equipment', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
    ],
  });
  doc.sectionTitle('Fire certificate / BOMBA');
  doc.table({
    columns: [
      { header: 'Certificate no.', width: 0.22 },
      { header: 'Issued by', width: 0.22 },
      { header: 'Valid from', width: 0.18 },
      { header: 'Valid to', width: 0.18 },
      { header: 'Remarks', width: 0.2 },
    ],
    rows: [
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ],
  });
  doc.paragraph(
    'Maintain copies of certificates in Admin → Documents. This register is a blank template for COB inspection readiness.',
    { size: 9, color: PDF_COLORS.muted },
  );
  addDisclaimer(doc);
  return doc.build();
}
