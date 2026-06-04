import { z } from 'zod';

export const InvoiceStatus = z.enum(['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const PaymentProvider = z.enum(['STRIPE', 'FPX', 'IPAY88', 'RAZER', 'MANUAL']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

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
  lines: z.array(InvoiceLineSchema).optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const formatMoney = (amount: number | string, currency = 'MYR') =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(Number(amount));
