/** Official receipt PDF, rendered through the shared modern layout engine. */
import { PDF_COLORS, PdfDocument, type TextRun } from '../common/pdf/pdf-document';

export type ReceiptPdfKind = 'PAYMENT' | 'DEPOSIT' | 'REFUND';

/** Live deposit balances shown on deposit receipts when the linked deposit is loaded. */
export interface DepositSummaryPdf {
  statusLabel: string;
  paidAt?: string;
  originalAmount: string;
  refundedAmount?: string;
  forfeitedAmount?: string;
  heldAmount?: string;
  notes?: string;
}

export interface ReceiptPdfData {
  organizationName: string;
  registrationNo?: string;
  addressLines?: string;
  receiptNumber: string;
  kind: ReceiptPdfKind;
  kindLabel: string;
  issuedAt: string;
  issuedToName?: string;
  unitLabel?: string;
  description?: string;
  amountLabel: string;
  methodLabel?: string;
  referenceLabel?: string;
  footerNote?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  /** Populated for deposit receipts — shows current held/refunded/forfeited balances. */
  depositSummary?: DepositSummaryPdf;
  /** LHDN MyInvois validated e-invoice identifiers, shown when present. */
  eInvoiceUuid?: string;
  eInvoiceLongId?: string;
  eInvoiceValidationUrl?: string;
}

function detailsSectionTitle(kind: ReceiptPdfKind): string {
  switch (kind) {
    case 'DEPOSIT':
      return 'Deposit Details';
    case 'REFUND':
      return 'Refund Details';
    default:
      return 'Payment Details';
  }
}

function amountHighlightLabel(kind: ReceiptPdfKind): string {
  switch (kind) {
    case 'DEPOSIT':
      return 'Deposit Received';
    case 'REFUND':
      return 'Amount Refunded';
    default:
      return 'Amount Received';
  }
}

/**
 * Build a single-page A4 receipt PDF with a branded header, aligned detail
 * rows, a highlighted amount block and (when present) a framed LHDN MyInvois
 * e-invoice panel with a QR placeholder. Zero external dependencies.
 */
export function buildReceiptPdf(data: ReceiptPdfData): Buffer {
  const doc = new PdfDocument({
    header: {
      brand: data.organizationName || 'Official Receipt',
      title: 'Official Receipt',
      subtitle: data.receiptNumber ? `No. ${data.receiptNumber}` : undefined,
    },
    footerNote: data.footerNote || undefined,
  });

  // Issuer contact block, directly under the header band.
  if (data.registrationNo) {
    doc.paragraph(`Registration No. ${data.registrationNo}`, { size: 9, color: PDF_COLORS.muted });
  }
  for (const addr of (data.addressLines ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    doc.paragraph(addr, { size: 9, color: PDF_COLORS.muted });
  }

  doc.divider();

  // Receipt identity.
  doc.labelValue('Receipt No.', data.receiptNumber);
  doc.labelValue('Type', data.kindLabel);
  doc.labelValue('Date', data.issuedAt);

  // Payer + unit.
  if (data.issuedToName || data.unitLabel) {
    doc.sectionTitle('Received From');
    if (data.issuedToName) doc.labelValue('Name', data.issuedToName);
    if (data.unitLabel) doc.labelValue('Unit', data.unitLabel);
  }

  const summary = data.depositSummary;
  const hasDepositDetails =
    data.kind === 'DEPOSIT' &&
    (data.description ||
      data.methodLabel ||
      data.referenceLabel ||
      summary?.paidAt ||
      summary?.statusLabel ||
      summary?.notes);

  const hasPaymentDetails =
    data.kind !== 'DEPOSIT' && (data.description || data.methodLabel || data.referenceLabel);

  if (hasDepositDetails) {
    doc.sectionTitle('Deposit Details');
    if (data.description) doc.labelValue('Deposit type', data.description);
    if (summary?.paidAt) doc.labelValue('Paid on', summary.paidAt);
    if (summary?.statusLabel) doc.labelValue('Status', summary.statusLabel);
    if (data.methodLabel) doc.labelValue('Method', data.methodLabel);
    if (data.referenceLabel) doc.labelValue('Reference', data.referenceLabel);
    if (summary?.notes) doc.labelValue('Notes', summary.notes);
  } else if (hasPaymentDetails) {
    doc.sectionTitle(detailsSectionTitle(data.kind));
    if (data.description) doc.labelValue('For', data.description);
    if (data.methodLabel) doc.labelValue('Method', data.methodLabel);
    if (data.referenceLabel) doc.labelValue('Reference', data.referenceLabel);
  }

  if (data.kind === 'DEPOSIT' && summary) {
    doc.sectionTitle('Deposit Summary');
    doc.labelValue('Original deposit', summary.originalAmount);
    if (summary.refundedAmount) doc.labelValue('Refunded', summary.refundedAmount);
    if (summary.forfeitedAmount) doc.labelValue('Forfeited', summary.forfeitedAmount);
    doc.labelValue('Balance held', summary.heldAmount ?? summary.originalAmount);
  }

  doc.spacer(6);
  doc.amountHighlight(amountHighlightLabel(data.kind), data.amountLabel);

  // LHDN MyInvois validated e-invoice panel with QR placeholder.
  if (data.eInvoiceUuid) {
    doc.spacer(6);
    doc.sectionTitle('LHDN MyInvois e-Invoice');
    const lines: TextRun[] = [
      { text: 'Validated e-Invoice', size: 9.5, bold: true },
      { text: `UUID: ${data.eInvoiceUuid}`, size: 8.5, color: PDF_COLORS.muted },
    ];
    if (data.eInvoiceLongId) {
      lines.push({ text: `Long ID: ${data.eInvoiceLongId}`, size: 8.5, color: PDF_COLORS.muted });
    }
    if (data.eInvoiceValidationUrl) {
      lines.push({
        text: `Verify: ${data.eInvoiceValidationUrl}`,
        size: 8.5,
        color: PDF_COLORS.muted,
      });
    }
    doc.calloutBox(lines, {
      qrPlaceholder: data.eInvoiceValidationUrl ? 'scan to verify' : undefined,
    });
  }

  if (data.signatoryName || data.signatoryTitle) {
    doc.spacer(10);
    doc.signature(data.signatoryName, data.signatoryTitle);
  }

  return doc.build();
}
