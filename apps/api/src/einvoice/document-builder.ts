import type {
  EInvoiceConfig,
  EInvoiceDocument,
  EInvoiceDocumentLine,
  EInvoiceDocumentParty,
} from '@smartresidence/shared-types';

/** LHDN "general public" buyer TIN used for consolidated / B2C e-invoices. */
export const LHDN_GENERAL_PUBLIC_TIN = 'EI00000000010';

const EINVOICE_VERSION = '1.0';
/** LHDN document type code 01 = Invoice. */
const EINVOICE_TYPE_CODE = '01';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface EInvoiceBuilderLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface EInvoiceBuilderBuyer {
  name: string;
  tin?: string;
  registrationNo?: string;
  email?: string;
  phone?: string;
  addressLines?: string[];
  city?: string;
  postcode?: string;
  state?: string;
  countryCode?: string;
}

export interface EInvoiceBuilderInput {
  invoiceNumber: string;
  issuedAt: Date;
  currencyCode: string;
  config: EInvoiceConfig;
  lines: EInvoiceBuilderLine[];
  buyer: EInvoiceBuilderBuyer;
}

function buildSupplierParty(config: EInvoiceConfig): EInvoiceDocumentParty {
  return {
    tin: config.supplierTin,
    name: config.supplierName,
    registrationNo: config.registrationNo || undefined,
    sstRegistrationNo: config.sstRegistrationNo || undefined,
    msicCode: config.msicCode || undefined,
    businessActivityDescription: config.businessActivityDescription || undefined,
    email: config.supplierEmail || undefined,
    phone: config.supplierPhone || undefined,
    address: {
      lines: [config.addressLine1, config.addressLine2].filter(Boolean),
      city: config.city,
      postcode: config.postcode,
      state: config.state,
      countryCode: config.countryCode || 'MYS',
    },
  };
}

function buildBuyerParty(buyer: EInvoiceBuilderBuyer): EInvoiceDocumentParty {
  return {
    tin: buyer.tin || LHDN_GENERAL_PUBLIC_TIN,
    name: buyer.name,
    registrationNo: buyer.registrationNo || undefined,
    email: buyer.email || undefined,
    phone: buyer.phone || undefined,
    address: {
      lines: buyer.addressLines?.filter(Boolean) ?? [],
      city: buyer.city ?? '',
      postcode: buyer.postcode ?? '',
      state: buyer.state ?? '',
      countryCode: buyer.countryCode || 'MYS',
    },
  };
}

/**
 * Build the core LHDN MyInvois (UBL 2.1) document for an invoice as a clean,
 * typed object. This intentionally covers the *core required* fields only:
 * supplier + buyer parties, line items with amounts + tax, totals, currency
 * (MYR) and invoice number/date.
 *
 * A production LHDN client must additionally add, on top of this snapshot:
 *  - The full UBL 2.1 envelope (Invoice/cbc/cac namespaces) or MyInvois JSON.
 *  - Digital signature (UBL cac:Signature + document hash) and certificate.
 *  - Invoice type-specific fields: original invoice ref for credit/debit notes,
 *    self-billed flag, currency exchange rate for non-MYR documents.
 *  - Classification codes per line (LHDN item classification list) and, where
 *    applicable, product tariff codes.
 *  - Registration scheme identifiers (BRN/NRIC/PASSPORT/ARMY) with scheme codes,
 *    MSIC business activity, and buyer SST registration where relevant.
 *  - Rounding, prepaid amounts, allowances/charges, and payment mode/terms.
 */
export function buildEInvoiceDocument(input: EInvoiceBuilderInput): EInvoiceDocument {
  const taxRate = Number(input.config.defaultTaxRate) || 0;
  const taxType = input.config.defaultTaxType || '06';

  const lines: EInvoiceDocumentLine[] = input.lines.map((line, index) => {
    const lineAmount = round2(Number(line.amount));
    const taxAmount = round2((lineAmount * taxRate) / 100);
    return {
      id: String(index + 1),
      description: line.description,
      quantity: Number(line.quantity) || 1,
      unitPrice: round2(Number(line.unitPrice)),
      lineAmount,
      taxType,
      taxRate,
      taxAmount,
    };
  });

  const taxExclusiveAmount = round2(lines.reduce((sum, l) => sum + l.lineAmount, 0));
  const taxAmount = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmount);

  return {
    eInvoiceVersion: EINVOICE_VERSION,
    eInvoiceTypeCode: EINVOICE_TYPE_CODE,
    invoiceNumber: input.invoiceNumber,
    issueDate: input.issuedAt.toISOString().slice(0, 10),
    issueTime: `${input.issuedAt.toISOString().slice(11, 19)}Z`,
    documentCurrencyCode: input.currencyCode || 'MYR',
    supplier: buildSupplierParty(input.config),
    buyer: buildBuyerParty(input.buyer),
    lines,
    taxExclusiveAmount,
    taxAmount,
    taxInclusiveAmount,
    totalPayableAmount: taxInclusiveAmount,
  };
}

/**
 * Validate that the core LHDN-required supplier fields are present. Returns the
 * list of missing field labels (empty when the document is submittable).
 */
export function validateEInvoiceDocument(doc: EInvoiceDocument): string[] {
  const missing: string[] = [];
  if (!doc.supplier.tin) missing.push('Supplier TIN');
  if (!doc.supplier.name) missing.push('Supplier name');
  if (!doc.supplier.msicCode) missing.push('MSIC business code');
  if (!doc.supplier.address.countryCode) missing.push('Supplier country');
  if (!doc.invoiceNumber) missing.push('Invoice number');
  if (doc.lines.length === 0) missing.push('At least one line item');
  return missing;
}
