import { z } from 'zod';

// -- Status ------------------------------------------------------------

export const EInvoiceStatus = z.enum(['NOT_SUBMITTED', 'PENDING', 'VALID', 'INVALID', 'CANCELLED']);
export type EInvoiceStatus = z.infer<typeof EInvoiceStatus>;

export const EINVOICE_STATUS_LABELS: Record<EInvoiceStatus, string> = {
  NOT_SUBMITTED: 'Not submitted',
  PENDING: 'Pending validation',
  VALID: 'Validated',
  INVALID: 'Rejected',
  CANCELLED: 'Cancelled',
};

export type EInvoiceStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export function eInvoiceStatusTone(status: EInvoiceStatus): EInvoiceStatusTone {
  switch (status) {
    case 'VALID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'INVALID':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const EInvoiceEnvironment = z.enum(['SANDBOX', 'PRODUCTION']);
export type EInvoiceEnvironment = z.infer<typeof EInvoiceEnvironment>;

// -- Condo e-invoice configuration ------------------------------------

/**
 * LHDN MyInvois supplier configuration, stored under `condo.settings.einvoice`.
 * The LHDN API client id/secret are NOT part of this object — they are
 * envelope-encrypted separately and never returned to the client.
 */
export const EInvoiceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  environment: EInvoiceEnvironment.default('SANDBOX'),
  /** Auto-create/submit an e-invoice when an invoice is issued (only when enabled). */
  autoSubmitOnIssue: z.boolean().default(false),
  /** Supplier Tax Identification Number, e.g. "C1234567890". */
  supplierTin: z.string().default(''),
  /** Legal name of the supplier (JMB / management corporation). */
  supplierName: z.string().default(''),
  /** Business registration number (BRN / SSM). */
  registrationNo: z.string().default(''),
  /** SST registration number (or "NA" when not SST-registered). */
  sstRegistrationNo: z.string().default(''),
  /** 5-digit MSIC 2008 business code. */
  msicCode: z.string().default(''),
  /** Plain-language business activity description. */
  businessActivityDescription: z.string().default(''),
  /** Supplier address. */
  addressLine1: z.string().default(''),
  addressLine2: z.string().default(''),
  city: z.string().default(''),
  postcode: z.string().default(''),
  /** LHDN state code, e.g. "10" (Selangor), "14" (WP Kuala Lumpur). */
  state: z.string().default(''),
  countryCode: z.string().default('MYS'),
  supplierEmail: z.string().default(''),
  supplierPhone: z.string().default(''),
  /**
   * Default tax type code applied to invoice lines (LHDN tax type codes:
   * "01" Sales Tax, "02" Service Tax, "06" Not Applicable, "E" Exempt).
   */
  defaultTaxType: z.string().default('06'),
  /** Default tax rate percent applied to invoice lines. */
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
});
export type EInvoiceConfig = z.infer<typeof EInvoiceConfigSchema>;

export const DEFAULT_EINVOICE_CONFIG: EInvoiceConfig = EInvoiceConfigSchema.parse({});

/** Sanitised config returned to clients — includes only whether a secret is set. */
export interface EInvoiceConfigView extends EInvoiceConfig {
  /** True when LHDN API client id + secret are stored (never the values). */
  secretConfigured: boolean;
  updatedAt?: string;
}

/** Update payload; every field optional, API credentials are write-only. */
export const UpdateEInvoiceConfigSchema = EInvoiceConfigSchema.partial().extend({
  /** LHDN MyInvois API client id (write-only; stored encrypted). */
  apiClientId: z.string().optional(),
  /** LHDN MyInvois API client secret (write-only; stored encrypted). */
  apiClientSecret: z.string().optional(),
});
export type UpdateEInvoiceConfigInput = z.infer<typeof UpdateEInvoiceConfigSchema>;

// -- Generated e-invoice document -------------------------------------

export interface EInvoiceDocumentAddress {
  lines: string[];
  city: string;
  postcode: string;
  state: string;
  countryCode: string;
}

export interface EInvoiceDocumentParty {
  tin: string;
  name: string;
  registrationNo?: string;
  sstRegistrationNo?: string;
  msicCode?: string;
  businessActivityDescription?: string;
  email?: string;
  phone?: string;
  address: EInvoiceDocumentAddress;
}

export interface EInvoiceDocumentLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  taxType: string;
  taxRate: number;
  taxAmount: number;
}

/**
 * A clean, typed snapshot of the core LHDN MyInvois (UBL 2.1) fields. A
 * production adapter maps this to the full UBL 2.1 XML/JSON document; see the
 * document builder for the list of fields a live client must additionally add.
 */
export interface EInvoiceDocument {
  eInvoiceVersion: string;
  eInvoiceTypeCode: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  documentCurrencyCode: string;
  supplier: EInvoiceDocumentParty;
  buyer: EInvoiceDocumentParty;
  lines: EInvoiceDocumentLine[];
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  totalPayableAmount: number;
}

// -- E-invoice view ---------------------------------------------------

export interface EInvoiceView {
  id: string;
  invoiceId: string;
  condoId: string;
  status: EInvoiceStatus;
  environment: string;
  lhdnUuid: string | null;
  lhdnLongId: string | null;
  submissionUid: string | null;
  qrPayload: string | null;
  validationUrl: string | null;
  errorMessage: string | null;
  validatedAt: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  document?: EInvoiceDocument | null;
}

export interface CancelEInvoiceInput {
  reason?: string;
}

/** LHDN tax type codes with friendly labels for the config UI. */
export const EINVOICE_TAX_TYPE_LABELS: Record<string, string> = {
  '01': 'Sales Tax',
  '02': 'Service Tax',
  '03': 'Tourism Tax',
  '04': 'High-Value Goods Tax',
  '05': 'Low Value Goods Tax',
  '06': 'Not Applicable',
  E: 'Tax exemption',
};
