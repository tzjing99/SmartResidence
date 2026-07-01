import { z } from 'zod';
import { FUND_LABELS, LedgerFund } from './billing';

/** Funds allowed on vendor bills (no deposit fund). */
export const VendorBillFund = z.enum(['MAINTENANCE', 'SINKING_FUND', 'GENERAL']);
export type VendorBillFund = z.infer<typeof VendorBillFund>;

export const VENDOR_BILL_FUND_LABELS: Record<VendorBillFund, string> = {
  MAINTENANCE: FUND_LABELS.MAINTENANCE,
  SINKING_FUND: FUND_LABELS.SINKING_FUND,
  GENERAL: FUND_LABELS.GENERAL,
};

export const VendorBillStatus = z.enum(['DRAFT', 'APPROVED', 'PAID', 'VOID']);
export type VendorBillStatus = z.infer<typeof VendorBillStatus>;

export const VENDOR_BILL_STATUS_LABELS: Record<VendorBillStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PAID: 'Paid',
  VOID: 'Void',
};

export const VendorSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  name: z.string(),
  contact: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type Vendor = z.infer<typeof VendorSchema>;

export const VendorBillSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  vendorId: z.string().uuid(),
  billNumber: z.string(),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  amount: z.coerce.number(),
  fund: VendorBillFund,
  status: VendorBillStatus,
  description: z.string().nullable().optional(),
  attachmentId: z.string().uuid().nullable().optional(),
  approvedByUserId: z.string().uuid().nullable().optional(),
  approvedAt: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  glJournalEntryId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  vendor: VendorSchema.pick({ id: true, name: true, contact: true, taxId: true })
    .nullable()
    .optional(),
  approvedBy: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});
export type VendorBill = z.infer<typeof VendorBillSchema>;

export const CreateVendorInputSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(2).max(200),
  contact: z.string().max(300).optional(),
  taxId: z.string().max(50).optional(),
  active: z.boolean().optional(),
});
export type CreateVendorInput = z.infer<typeof CreateVendorInputSchema>;

export const UpdateVendorInputSchema = CreateVendorInputSchema.partial().omit({ condoId: true });
export type UpdateVendorInput = z.infer<typeof UpdateVendorInputSchema>;

export const CreateVendorBillInputSchema = z.object({
  condoId: z.string().uuid(),
  vendorId: z.string().uuid(),
  billNumber: z.string().min(1).max(80),
  billDate: z.string(),
  dueDate: z.string(),
  amount: z.number().positive(),
  fund: VendorBillFund,
  description: z.string().max(2000).optional(),
  attachmentId: z.string().uuid().optional(),
});
export type CreateVendorBillInput = z.infer<typeof CreateVendorBillInputSchema>;

export const UpdateVendorBillInputSchema = CreateVendorBillInputSchema.partial().omit({
  condoId: true,
});
export type UpdateVendorBillInput = z.infer<typeof UpdateVendorBillInputSchema>;

export const ListVendorsParamsSchema = z.object({
  activeOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});
export type ListVendorsParams = z.infer<typeof ListVendorsParamsSchema>;

export const ListVendorBillsParamsSchema = z.object({
  status: VendorBillStatus.optional(),
  fund: VendorBillFund.optional(),
  vendorId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});
export type ListVendorBillsParams = z.infer<typeof ListVendorBillsParamsSchema>;

export const VendorSpendByFundRowSchema = z.object({
  fund: VendorBillFund,
  totalPaid: z.number(),
  billCount: z.number().int(),
});
export type VendorSpendByFundRow = z.infer<typeof VendorSpendByFundRowSchema>;

/** Re-export for reports that need full LedgerFund typing. */
export type { LedgerFund };
