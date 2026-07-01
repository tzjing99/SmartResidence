import { describe, expect, it } from 'vitest';
import { CreateVendorBillInputSchema, VendorBillFund, VendorBillStatus } from './procurement';

describe('procurement shared types', () => {
  it('accepts valid vendor bill input', () => {
    const parsed = CreateVendorBillInputSchema.parse({
      condoId: '550e8400-e29b-41d4-a716-446655440000',
      vendorId: '550e8400-e29b-41d4-a716-446655440001',
      billNumber: 'INV-2026-001',
      billDate: '2026-01-15',
      dueDate: '2026-02-15',
      amount: 1500.5,
      fund: 'MAINTENANCE',
    });
    expect(parsed.fund).toBe('MAINTENANCE');
  });

  it('defines vendor bill lifecycle statuses', () => {
    expect(VendorBillStatus.options).toEqual(['DRAFT', 'APPROVED', 'PAID', 'VOID']);
  });

  it('restricts vendor bill funds to maintenance, sinking, general', () => {
    expect(VendorBillFund.options).toEqual(['MAINTENANCE', 'SINKING_FUND', 'GENERAL']);
  });
});
