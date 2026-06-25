import { z } from 'zod';

export const InvoiceStatus = z.enum(['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const PaymentProvider = z.enum(['STRIPE', 'FPX', 'IPAY88', 'RAZER', 'MANUAL']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

export const PaymentStatus = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

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
  lines: RecurringLineInput[];
  unitIds?: string[];
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIAL: 'Partially paid',
  PAID: 'Paid',
  VOID: 'Void',
  OVERDUE: 'Overdue',
};

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
