/** Printable renovation (and similar) permit PDF with embedded QR matrix. */
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

export interface PermitPdfData {
  organizationName: string;
  permitTitle: string;
  reference: string;
  unitLabel: string;
  residentName: string;
  contractorCompany?: string;
  workScope?: string;
  validFrom?: string;
  validUntil?: string;
  accessCode: string;
  /** Square boolean matrix from `qrcode.create(...).modules` (row-major). */
  qrModules: ReadonlyArray<ReadonlyArray<boolean>>;
  approvedAt?: string;
  approvedByName?: string;
  footerNote?: string;
}

/**
 * Build a single-page A4 permit PDF with condo branding, validity window,
 * short access code, and a scannable QR matrix for guard verification.
 */
export function buildPermitPdf(data: PermitPdfData): Buffer {
  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'SmartResidence',
      title: data.permitTitle || 'Renovation Permit',
      subtitle: data.reference ? `Ref ${data.reference}` : undefined,
    },
    footerNote:
      data.footerNote ||
      'Present this permit (or the QR / access code) at the guardhouse for verification.',
  });

  doc.paragraph('This permit authorises the work described below for the stated unit.', {
    size: 10,
    color: PDF_COLORS.muted,
  });
  doc.divider();

  doc.sectionTitle('Permit details');
  doc.labelValue('Unit', data.unitLabel);
  doc.labelValue('Resident', data.residentName);
  if (data.contractorCompany) doc.labelValue('Contractor', data.contractorCompany);
  if (data.workScope) doc.labelValue('Work scope', data.workScope);
  if (data.validFrom) doc.labelValue('Valid from', data.validFrom);
  if (data.validUntil) doc.labelValue('Valid until', data.validUntil);
  if (data.approvedAt) doc.labelValue('Approved on', data.approvedAt);
  if (data.approvedByName) doc.labelValue('Approved by', data.approvedByName);

  doc.spacer(8);
  doc.sectionTitle('Gate verification');
  doc.amountHighlight('Access code', data.accessCode);
  doc.spacer(6);
  doc.qrMatrix(data.qrModules, {
    size: 132,
    caption: 'Scan at the guardhouse · same code as above',
  });

  doc.spacer(16);
  doc.signature(data.approvedByName, 'Management');

  return doc.build();
}
