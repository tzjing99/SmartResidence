import { z } from 'zod';

export const InvoiceStatus = z.enum(['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const PaymentProvider = z.enum(['STRIPE', 'FPX', 'IPAY88', 'RAZER', 'DUITNOW_QR', 'MANUAL']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

export const PaymentStatus = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting confirmation',
  SUCCEEDED: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

export type PaymentStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export function paymentStatusTone(status: PaymentStatus): PaymentStatusTone {
  switch (status) {
    case 'SUCCEEDED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Hide superseded gateway attempts from payment history lists. */
export function visibleInvoicePayments<T extends { status: PaymentStatus }>(payments: T[]): T[] {
  return payments.filter((p) => p.status !== 'CANCELLED');
}

export const InvoiceLineSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  description: z.string(),
  formula: z.string().nullable().optional(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  amount: z.coerce.number(),
  sortOrder: z.number().int(),
});
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number(),
  currencyCode: z.string(),
  status: PaymentStatus,
  provider: PaymentProvider,
  providerRef: z.string().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  number: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  dueDate: z.coerce.date(),
  status: InvoiceStatus,
  subtotal: z.coerce.number(),
  total: z.coerce.number(),
  amountPaid: z.coerce.number(),
  currencyCode: z.string(),
  issuedAt: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  voidedAt: z.coerce.date().nullable().optional(),
  lines: z.array(InvoiceLineSchema).optional(),
  payments: z.array(PaymentSchema).optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export interface RecurringLineInput {
  code: string;
  description: string;
  formula?: string;
  unitPrice: number;
  quantity?: number;
}

export interface RecordManualPaymentInput {
  amount?: number;
  method?: string;
  reference?: string;
  note?: string;
}

export interface GenerateRecurringInput {
  periodStart: Date | string;
  periodEnd: Date | string;
  dueDate: Date | string;
  /** Omit to auto-compute maintenance + sinking-fund lines from unit-type fee rates. */
  lines?: RecurringLineInput[];
  unitIds?: string[];
}

export const BillingAutomationPeriodStrategy = z.enum(['CURRENT_MONTH', 'NEXT_MONTH']);
export type BillingAutomationPeriodStrategy = z.infer<typeof BillingAutomationPeriodStrategy>;

export const BillingAutomationDueStrategy = z.enum(['DAY_OF_MONTH', 'OFFSET_DAYS']);
export type BillingAutomationDueStrategy = z.infer<typeof BillingAutomationDueStrategy>;

export const BillingAutomationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  generationDay: z.coerce.number().int().min(1).max(31).default(1),
  periodStrategy: BillingAutomationPeriodStrategy.default('NEXT_MONTH'),
  dueStrategy: BillingAutomationDueStrategy.default('DAY_OF_MONTH'),
  dueDay: z.coerce.number().int().min(1).max(31).default(15),
  dueOffsetDays: z.coerce.number().int().min(0).max(90).default(14),
  lastRunAt: z.string().optional(),
  lastRunPeriodStart: z.string().optional(),
  lastRunPeriodEnd: z.string().optional(),
  lastRunCreated: z.number().optional(),
  lastRunSkipped: z.number().optional(),
  lastRunSkippedNoRate: z.number().optional(),
});
export type BillingAutomationSettings = z.infer<typeof BillingAutomationSettingsSchema>;

export const DEFAULT_BILLING_AUTOMATION_SETTINGS: BillingAutomationSettings = {
  enabled: false,
  generationDay: 1,
  periodStrategy: 'NEXT_MONTH',
  dueStrategy: 'DAY_OF_MONTH',
  dueDay: 15,
  dueOffsetDays: 14,
};

export interface BillingAutomationPreview {
  condoId: string;
  enabled: boolean;
  dueToRun: boolean;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  generationDay: number;
  runOnOrAfter: string;
  units: number;
  billableUnits: number;
  alreadyBilled: number;
  wouldCreate: number;
  skippedNoRate: number;
  skipReason?: 'disabled' | 'not_due' | 'no_units' | 'no_billable_units' | 'already_generated';
}

export interface BillingAutomationRunResult extends BillingAutomationPreview {
  dryRun: boolean;
  created: number;
  skipped: number;
  skippedNoRate: number;
  ranAt: string;
}

// -- Admin automation pipeline -----------------------------------------

export const AutomationJobKey = z.enum([
  'BILLING_GENERATION',
  'DUE_SWEEP',
  'PAYMENT_RECONCILIATION',
  'PAYMENT_REVIEW',
  'REMINDERS',
]);
export type AutomationJobKey = z.infer<typeof AutomationJobKey>;

export const AutomationRunStatus = z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED']);
export type AutomationRunStatus = z.infer<typeof AutomationRunStatus>;

export type AutomationSummary = Record<string, string | number | boolean | null | undefined>;

export interface AutomationRunView {
  id: string;
  condoId: string;
  jobKey: AutomationJobKey;
  stageName: string;
  status: AutomationRunStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  summary: AutomationSummary;
  errorMessage: string | null;
  triggeredByUserId: string | null;
  createdAt: string;
}

export interface AutomationStageStatus {
  jobKey: AutomationJobKey;
  name: string;
  description: string;
  status: AutomationRunStatus;
  currentStage: string;
  nextScheduledAt: string | null;
  upcomingLabel: string | null;
  latestRun: AutomationRunView | null;
  summary: AutomationSummary;
  errorMessage: string | null;
}

export interface AutomationStatusResponse {
  condoId: string;
  condoName: string;
  generatedAt: string;
  stages: AutomationStageStatus[];
  recentRuns: AutomationRunView[];
}

export const AUTOMATION_JOB_LABELS: Record<AutomationJobKey, string> = {
  BILLING_GENERATION: 'Monthly invoice generation',
  DUE_SWEEP: 'Overdue invoice check',
  PAYMENT_RECONCILIATION: 'Payment gateway check',
  PAYMENT_REVIEW: 'Payments to review',
  REMINDERS: 'Payment reminders',
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationRunStatus, string> = {
  PENDING: 'Scheduled',
  RUNNING: 'In progress',
  SUCCESS: 'Completed',
  FAILED: 'Failed — needs attention',
  SKIPPED: 'Did not run',
};

/** Plain-language reasons why automatic invoice generation was skipped. */
export const AUTOMATION_SKIP_REASON_LABELS: Record<
  NonNullable<BillingAutomationPreview['skipReason']>,
  string
> = {
  disabled: 'Automatic generation is turned off',
  not_due: 'Not scheduled to run today',
  no_units: 'No units in the building yet',
  no_billable_units: 'Fee rates are not set up',
  already_generated: 'Invoices already exist for this period',
};

/** Human-readable automation run summary for admin dashboards. */
export function formatAutomationSummary(summary: AutomationSummary): string {
  const parts: string[] = [];

  const skipReason = summary.skipReason;
  if (typeof skipReason === 'string' && skipReason in AUTOMATION_SKIP_REASON_LABELS) {
    parts.push(
      AUTOMATION_SKIP_REASON_LABELS[
        skipReason as NonNullable<BillingAutomationPreview['skipReason']>
      ],
    );
  }

  if (typeof summary.created === 'number' && summary.created > 0) {
    parts.push(`Created ${summary.created} invoice${summary.created === 1 ? '' : 's'}`);
  } else if (typeof summary.wouldCreate === 'number' && summary.wouldCreate > 0) {
    parts.push(
      `Would create ${summary.wouldCreate} invoice${summary.wouldCreate === 1 ? '' : 's'}`,
    );
  }

  if (typeof summary.failedPayments === 'number' && summary.failedPayments > 0) {
    parts.push(
      `${summary.failedPayments} failed payment${summary.failedPayments === 1 ? '' : 's'}`,
    );
  }

  if (typeof summary.flaggedForReview === 'number' && summary.flaggedForReview > 0) {
    parts.push(
      `${summary.flaggedForReview} payment${summary.flaggedForReview === 1 ? '' : 's'} to review`,
    );
  }

  if (parts.length === 0) {
    if (summary.enabled === false) {
      parts.push('Automatic generation is turned off');
    } else if (summary.enabled === true) {
      parts.push('Automatic generation is on');
    }
  }

  return parts.length === 0 ? 'No details yet' : parts.slice(0, 3).join(' · ');
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Awaiting payment',
  PARTIAL: 'Partly paid',
  PAID: 'Paid',
  VOID: 'Cancelled',
  OVERDUE: 'Overdue',
};

// -- Fee schedule (per unit type) -------------------------------------

export const FeeRateType = z.enum(['PER_SQFT', 'FLAT']);
export type FeeRateType = z.infer<typeof FeeRateType>;

export const FeeScheduleLineRateType = z.enum(['FLAT', 'PER_SQFT', 'PER_UNIT_TYPE']);
export type FeeScheduleLineRateType = z.infer<typeof FeeScheduleLineRateType>;

export const FeeScheduleLineCategory = z.enum([
  'FIRE_INSURANCE',
  'QUIT_RENT',
  'ASSESSMENT',
  'SPECIAL_LEVY',
  'SECURITY',
  'FACILITY_CHARGE',
  'LATE_PENALTY',
  'OTHER',
]);
export type FeeScheduleLineCategory = z.infer<typeof FeeScheduleLineCategory>;

export const UnitTypeFeeRateSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  maintenanceRateType: FeeRateType,
  maintenanceAmount: z.coerce.number(),
  sinkingFundRateType: FeeRateType,
  sinkingFundAmount: z.coerce.number(),
  currencyCode: z.string(),
  effectiveFrom: z.coerce.date().optional(),
});
export type UnitTypeFeeRate = z.infer<typeof UnitTypeFeeRateSchema>;

export interface UpsertFeeRateInput {
  unitTypeId: string;
  maintenanceRateType: FeeRateType;
  maintenanceAmount: number;
  sinkingFundRateType: FeeRateType;
  sinkingFundAmount: number;
}

export const FeeScheduleExtraLineSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  code: z.string(),
  description: z.string(),
  category: FeeScheduleLineCategory.or(z.string()),
  formula: z.string().nullable().optional(),
  rateType: FeeScheduleLineRateType,
  amount: z.coerce.number(),
  unitTypeAmounts: z.record(z.coerce.number()).default({}),
  recurring: z.boolean(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type FeeScheduleExtraLine = z.infer<typeof FeeScheduleExtraLineSchema>;

export interface UpsertFeeScheduleExtraLineInput {
  id?: string;
  code: string;
  description: string;
  category?: FeeScheduleLineCategory | string;
  formula?: string;
  rateType: FeeScheduleLineRateType;
  amount?: number;
  unitTypeAmounts?: Record<string, number>;
  recurring?: boolean;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  enabled?: boolean;
  sortOrder?: number;
}

export interface AddFeeSchedulePresetsInput {
  month?: string;
  recurring?: boolean;
  presetCodes?: FeeScheduleLineCategory[];
}

export const FEE_SCHEDULE_CATEGORY_LABELS: Record<FeeScheduleLineCategory, string> = {
  FIRE_INSURANCE: 'Fire insurance',
  QUIT_RENT: 'Quit rent',
  ASSESSMENT: 'Assessment',
  SPECIAL_LEVY: 'Special levy',
  SECURITY: 'Security',
  FACILITY_CHARGE: 'Facility charge',
  LATE_PENALTY: 'Late penalty',
  OTHER: 'Other',
};

export const COMMON_FEE_SCHEDULE_PRESETS: Array<{
  category: FeeScheduleLineCategory;
  code: string;
  description: string;
  formula: string;
}> = [
  {
    category: 'FIRE_INSURANCE',
    code: 'FIRE',
    description: 'Fire insurance premium',
    formula: 'Shared building insurance apportioned to each unit',
  },
  {
    category: 'QUIT_RENT',
    code: 'QUIT',
    description: 'Quit rent',
    formula: 'Annual land tax apportioned to this billing period',
  },
  {
    category: 'ASSESSMENT',
    code: 'ASSESS',
    description: 'Local council assessment',
    formula: 'Assessment charge apportioned by management',
  },
  {
    category: 'SPECIAL_LEVY',
    code: 'LEVY',
    description: 'Special levy',
    formula: 'One-off approved levy for the selected billing month',
  },
];

/**
 * Compute a monthly fee from a rate config and a unit's floor area.
 * PER_SQFT multiplies by sqft; FLAT is the amount as-is. Rounded to 2 dp.
 */
export const computeFeeAmount = (
  rateType: FeeRateType,
  amount: number,
  sqft: number | null | undefined,
): number => {
  const base = rateType === 'PER_SQFT' ? amount * Number(sqft ?? 0) : amount;
  return Math.round(base * 100) / 100;
};

// -- Deposits ---------------------------------------------------------

export const DepositType = z.enum([
  'RENOVATION',
  'RENOVATION_DELIVERY',
  'ACCESS_CARD',
  'KEY',
  'MOVE_IN_OUT',
  'OTHER',
]);
export type DepositType = z.infer<typeof DepositType>;

export const DepositStatus = z.enum(['HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FORFEITED']);
export type DepositStatus = z.infer<typeof DepositStatus>;

export const DepositSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  type: DepositType,
  amount: z.coerce.number(),
  currencyCode: z.string(),
  status: DepositStatus,
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  refundedAmount: z.coerce.number(),
  forfeitedAmount: z.coerce.number(),
  paidAt: z.coerce.date(),
  refundedAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});
export type Deposit = z.infer<typeof DepositSchema>;

export interface RecordDepositInput {
  unitId: string;
  userId?: string;
  type: DepositType;
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: Date | string;
  notes?: string;
}

export interface RefundDepositInput {
  amount?: number;
  forfeit?: boolean;
  note?: string;
}

export const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  RENOVATION: 'Renovation deposit',
  RENOVATION_DELIVERY: 'Delivery deposit',
  ACCESS_CARD: 'Access card deposit',
  KEY: 'Key deposit',
  MOVE_IN_OUT: 'Move in/out deposit',
  OTHER: 'Other deposit',
};

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  HELD: 'Still held by management',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Fully refunded',
  FORFEITED: 'Forfeited',
};

/** Amount still held by management (never negative). */
export const depositHeldAmount = (d: {
  amount: number | string;
  refundedAmount: number | string;
  forfeitedAmount: number | string;
}) => Math.max(0, Number(d.amount) - Number(d.refundedAmount) - Number(d.forfeitedAmount));

// -- Receipts ---------------------------------------------------------

export const ReceiptKind = z.enum(['PAYMENT', 'DEPOSIT', 'REFUND']);
export type ReceiptKind = z.infer<typeof ReceiptKind>;

export const ReceiptSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  number: z.string(),
  kind: ReceiptKind,
  amount: z.coerce.number(),
  currencyCode: z.string(),
  issuedToUserId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  paymentId: z.string().uuid().nullable().optional(),
  depositId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  pdfKey: z.string().nullable().optional(),
  issuedAt: z.coerce.date(),
  voidedAt: z.coerce.date().nullable().optional(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const RECEIPT_KIND_LABELS: Record<ReceiptKind, string> = {
  PAYMENT: 'Payment',
  DEPOSIT: 'Deposit',
  REFUND: 'Refund',
};

// -- Receipt template (admin-configurable) ----------------------------

export const ReceiptTemplateConfig = z.object({
  numberPrefix: z.string().default('RCPT'),
  organizationName: z.string().default(''),
  registrationNo: z.string().default(''),
  addressLines: z.string().default(''),
  footerNote: z.string().default('This is a computer-generated receipt.'),
  signatoryName: z.string().default(''),
  signatoryTitle: z.string().default('Authorised Signatory'),
  logoUrl: z.string().default(''),
});
export type ReceiptTemplateConfig = z.infer<typeof ReceiptTemplateConfig>;

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  numberPrefix: 'RCPT',
  organizationName: '',
  registrationNo: '',
  addressLines: '',
  footerNote: 'This is a computer-generated receipt.',
  signatoryName: '',
  signatoryTitle: 'Authorised Signatory',
  logoUrl: '',
};

// -- Accounting ledger & reports --------------------------------------

export const LedgerFund = z.enum(['MAINTENANCE', 'SINKING_FUND', 'DEPOSIT', 'GENERAL']);
export type LedgerFund = z.infer<typeof LedgerFund>;

export const LedgerEntryType = z.enum([
  'CHARGE',
  'PAYMENT',
  'DEPOSIT',
  'REFUND',
  'PREPAYMENT',
  'PREPAYMENT_APPLIED',
  'ADJUSTMENT',
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryType>;

export const FUND_LABELS: Record<LedgerFund, string> = {
  MAINTENANCE: 'Maintenance account',
  SINKING_FUND: 'Sinking fund',
  DEPOSIT: 'Deposits held',
  GENERAL: 'General',
};

export interface RecordPrepaymentInput {
  unitId: string;
  userId?: string;
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
}

export interface CreateAdvancePaymentInput {
  unitId: string;
  amount: number;
  provider: PaymentProvider;
  returnUrl?: string;
}

export interface PaymentIntentResponse {
  paymentId?: string;
  advancePaymentId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  formPost?: { url: string; fields: Record<string, string> };
  /** EMVCo / DuitNow QR string for the resident to scan. */
  qrPayload?: string;
  /** Base64 PNG data URL of the QR (optional convenience for clients without a QR lib). */
  qrImageUrl?: string;
  providerRef: string;
}

export interface DuitNowQrPollResponse {
  status: PaymentStatus;
  settled: boolean;
  pending?: boolean;
}

export interface FundBalance {
  fund: LedgerFund;
  balance: number;
}

export interface CollectionsSummary {
  from: string;
  to: string;
  total: number;
  count: number;
  byFund: FundBalance[];
}

/** Opening/closing cash position per fund for AGM and auditor exports. */
export interface FundSummaryRow {
  fund: LedgerFund;
  openingBalance: number;
  collections: number;
  chargesIssued: number;
  adjustments: number;
  closingBalance: number;
}

export interface FundSummaryReport {
  from: string;
  to: string;
  funds: FundSummaryRow[];
}

export interface IncomeExpenseCategoryRow {
  code: string;
  description: string;
  fund: LedgerFund;
  charges: number;
  collections: number;
}

export interface IncomeExpenseReport {
  from: string;
  to: string;
  byFund: Array<{
    fund: LedgerFund;
    collections: number;
    charges: number;
  }>;
  byCategory: IncomeExpenseCategoryRow[];
}

/** Malaysian fund labels for AGM / auditor financial statements. */
export const STATEMENT_FUND_LABELS: Record<LedgerFund, string> = {
  MAINTENANCE: 'Maintenance fund',
  SINKING_FUND: 'Sinking fund',
  DEPOSIT: 'Deposits held',
  GENERAL: 'General fund',
};

export interface FinancialStatementLineItem {
  label: string;
  code?: string;
  amount: number;
}

export interface FinancialStatementSection {
  title: string;
  lines: FinancialStatementLineItem[];
  total: number;
}

/** Profit & loss (income statement) for a date range, optionally scoped to one fund. */
export interface ProfitLossReport {
  from: string;
  to: string;
  fund: LedgerFund | 'ALL';
  fundLabel: string;
  income: FinancialStatementSection;
  expenses: FinancialStatementSection;
  netSurplus: number;
}

/** Balance sheet as at a single date — assets, liabilities, and fund equity. */
export interface BalanceSheetReport {
  asOf: string;
  assets: FinancialStatementSection;
  liabilities: FinancialStatementSection;
  funds: FinancialStatementSection;
  totalAssets: number;
  totalLiabilitiesAndFunds: number;
}

export interface ArrearsAgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
  count: number;
}

export interface ArrearsAging {
  buckets: ArrearsAgingBucket[];
  totalOutstanding: number;
  unitsInArrears: number;
  invoicesInArrears?: number;
}

export interface PaymentIssue {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  unitIdentifier: string;
  amount: number;
  currencyCode: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRef: string | null;
  createdAt: string;
  reviewReason?: string;
  reportedAmount?: number;
  expectedAmount?: number;
  gatewayStatus?: string;
}

export const PAYMENT_REVIEW_REASON_LABELS: Record<string, string> = {
  AMOUNT_MISMATCH: 'Bank reported a different amount',
};

export interface UnitStatementEntry {
  occurredAt: string;
  type: LedgerEntryType;
  fund: LedgerFund;
  description: string;
  charge: number;
  payment: number;
  balance: number;
}

export interface UnitStatement {
  unitId: string;
  creditBalance: number;
  totalOutstanding: number;
  entries: UnitStatementEntry[];
}

export const ARREARS_BUCKET_LABELS: Record<ArrearsAgingBucket['bucket'], string> = {
  '0-30': '0–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
};

// -- Payment gateway connections --------------------------------------

export const GatewayMode = z.enum(['TEST', 'LIVE']);
export type GatewayMode = z.infer<typeof GatewayMode>;

/** Providers an admin can self-connect from the gateway settings UI. */
export const CONNECTABLE_PROVIDERS: PaymentProvider[] = ['STRIPE', 'RAZER', 'IPAY88', 'DUITNOW_QR'];

export const GATEWAY_PROVIDER_LABELS: Record<string, string> = {
  STRIPE: 'Stripe (card)',
  RAZER: 'Fiuu (FPX / e-wallet / card)',
  IPAY88: 'iPay88 (FPX / e-wallet / card)',
  DUITNOW_QR: 'DuitNow QR',
  FPX: 'FPX',
  MANUAL: 'Manual / offline',
};

/** Short brand names for gateway cards (capabilities are shown separately). */
export const GATEWAY_PROVIDER_SHORT_LABELS: Record<string, string> = {
  STRIPE: 'Stripe',
  RAZER: 'Fiuu',
  IPAY88: 'iPay88',
  DUITNOW_QR: 'DuitNow QR',
  FPX: 'FPX',
  MANUAL: 'Manual / offline',
};

/**
 * Plain-English capability summary shown on each gateway card so admins know
 * exactly what a gateway can and cannot do before enabling it. Copy is kept in
 * sync with the real provider adapters in `apps/api/src/billing/providers`.
 */
export interface GatewayCapabilityInfo {
  /** One-line description of the gateway. */
  tagline: string;
  /** How the resident completes payment at checkout. */
  checkout: string;
  /** Payment methods residents can use through this gateway. */
  accepts: string[];
  /** Notable limitations, so capabilities are never overstated. */
  limitations: string[];
}

export const GATEWAY_CAPABILITIES: Record<string, GatewayCapabilityInfo> = {
  STRIPE: {
    tagline: 'International credit and debit cards.',
    checkout: 'Resident pays with a card on a secure card form.',
    accepts: ['Visa, Mastercard and American Express', 'Cards issued outside Malaysia'],
    limitations: ['No FPX online banking', 'No local e-wallets or DuitNow QR'],
  },
  RAZER: {
    tagline: 'All-in-one Malaysian gateway: FPX, cards and e-wallets.',
    checkout: 'Resident is sent to the Fiuu hosted page to pick a method.',
    accepts: [
      'FPX online banking (all major Malaysian banks)',
      'Credit and debit cards',
      "E-wallets (Touch 'n Go, GrabPay, Boost, ShopeePay)",
      'DuitNow',
    ],
    limitations: ['Payment happens on the Fiuu hosted page, not inside the app'],
  },
  IPAY88: {
    tagline: 'Malaysian gateway for FPX, cards and e-wallets.',
    checkout: 'Resident is sent to the iPay88 hosted page to pick a method.',
    accepts: ['FPX online banking', 'Credit and debit cards', 'E-wallets'],
    limitations: ['Payment happens on the iPay88 hosted page, not inside the app'],
  },
  DUITNOW_QR: {
    tagline: 'Scan-to-pay QR for any Malaysian bank or e-wallet app.',
    checkout: 'Resident scans a QR code shown on screen — no redirect.',
    accepts: ['DuitNow QR from any Malaysian banking or e-wallet app'],
    limitations: ['Cards are not accepted directly', 'Resident needs a supported banking app'],
  },
};

/** Which credential fields each provider expects (labels for the admin UI). */
export const GATEWAY_CREDENTIAL_FIELDS: Record<string, { key: string; label: string }[]> = {
  STRIPE: [
    { key: 'secretKey', label: 'Secret key (sk_…)' },
    { key: 'webhookSecret', label: 'Webhook signing secret (whsec_…)' },
  ],
  RAZER: [
    { key: 'merchantId', label: 'Merchant ID' },
    { key: 'verifyKey', label: 'Verify key (private key)' },
    { key: 'secretKey', label: 'Secret key' },
  ],
  IPAY88: [
    { key: 'merchantCode', label: 'Merchant code' },
    { key: 'merchantKey', label: 'Merchant key' },
  ],
  DUITNOW_QR: [
    { key: 'merchantId', label: 'Merchant ID (PayNet / acquirer)' },
    { key: 'clientId', label: 'API client ID' },
    { key: 'clientSecret', label: 'API client secret' },
    { key: 'webhookSecret', label: 'Webhook signing secret' },
  ],
};

/** Sanitised gateway connection (never includes decrypted secrets). */
export interface GatewayConnectionView {
  id: string;
  provider: PaymentProvider;
  mode: GatewayMode;
  enabled: boolean;
  displayName: string | null;
  publicConfig: Record<string, unknown>;
  configured: boolean;
  updatedAt: string;
}

export interface UpsertGatewayInput {
  provider: PaymentProvider;
  mode: GatewayMode;
  enabled?: boolean;
  displayName?: string;
  publicConfig?: Record<string, unknown>;
  /** Plaintext credentials; only sent on create/update, never returned. */
  credentials?: Record<string, string>;
}

/** A payment method the resident can choose at checkout (enabled gateways). */
export interface PayableMethod {
  provider: PaymentProvider;
  label: string;
  mode: GatewayMode;
}

export const formatMoney = (amount: number | string, currency = 'MYR') =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(Number(amount));

/** Remaining balance on an invoice (never negative). */
export const invoiceOutstanding = (inv: { total: number | string; amountPaid: number | string }) =>
  Math.max(0, Number(inv.total) - Number(inv.amountPaid));

/** True when an issued/partial invoice is past its due date. */
export const isInvoiceOverdue = (inv: {
  status: InvoiceStatus;
  dueDate: Date | string;
}): boolean => {
  if (inv.status === 'OVERDUE') return true;
  if (inv.status !== 'ISSUED' && inv.status !== 'PARTIAL') return false;
  return new Date(inv.dueDate).getTime() < Date.now();
};
