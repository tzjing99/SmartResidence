import type { AuthenticatedUser } from '@/common/types/request-context';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleId, VendorBillStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { VendorBillService } from './vendor-bill.service';
import { VendorService } from './vendor.service';

function manager(condoId = 'condo-1'): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'admin@test.c',
    name: 'Admin',
    locale: 'en',
    activeCondoId: condoId,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId, unitId: null, permissions: [] }],
  };
}

function staff(condoId = 'condo-1'): AuthenticatedUser {
  return {
    id: 'staff-1',
    email: 'staff@test.c',
    name: 'Staff',
    locale: 'en',
    activeCondoId: condoId,
    activeRole: RoleId.MANAGEMENT_STAFF,
    roles: [{ roleId: RoleId.MANAGEMENT_STAFF, condoId, unitId: null, permissions: [] }],
  };
}

describe('VendorBillService', () => {
  const prisma = {
    vendorBill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    attachment: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const vendors = {
    requireVendor: vi.fn(),
  } as unknown as VendorService;

  const glPosting = {
    postVendorBillApproved: vi.fn(),
    postVendorBillPaid: vi.fn(),
  };

  const svc = new VendorBillService(prisma as never, vendors, glPosting as never);

  it('rejects approve from management staff', async () => {
    prisma.vendorBill.findUnique.mockResolvedValue({
      id: 'bill-1',
      condoId: 'condo-1',
      status: VendorBillStatus.DRAFT,
      billNumber: 'INV-1',
      billDate: new Date('2026-01-01'),
      amount: 100,
      fund: 'MAINTENANCE',
      description: null,
      vendor: { id: 'v-1', name: 'Acme', contact: null, taxId: null },
      approvedBy: null,
    });

    await expect(svc.approve(staff(), 'bill-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves draft bill and posts GL accrual', async () => {
    const draft = {
      id: 'bill-1',
      condoId: 'condo-1',
      status: VendorBillStatus.DRAFT,
      billNumber: 'INV-1',
      billDate: new Date('2026-01-01'),
      amount: 250,
      fund: 'MAINTENANCE',
      description: 'Lift service',
      vendor: { id: 'v-1', name: 'Acme', contact: null, taxId: null },
      approvedBy: null,
    };
    prisma.vendorBill.findUnique.mockResolvedValue(draft);
    prisma.vendorBill.update.mockResolvedValue({
      ...draft,
      status: VendorBillStatus.APPROVED,
      approvedByUserId: 'admin-1',
      approvedAt: new Date(),
      approvedBy: { id: 'admin-1', name: 'Admin' },
      dueDate: new Date('2026-02-01'),
    });
    prisma.auditLog.create.mockResolvedValue({});

    const result = await svc.approve(manager(), 'bill-1');
    expect(result.status).toBe('APPROVED');
    expect(glPosting.postVendorBillApproved).toHaveBeenCalled();
  });

  it('marks approved bill paid and stores journal link', async () => {
    const approved = {
      id: 'bill-1',
      condoId: 'condo-1',
      status: VendorBillStatus.APPROVED,
      billNumber: 'INV-1',
      billDate: new Date('2026-01-01'),
      amount: 250,
      fund: 'MAINTENANCE',
      description: null,
      vendor: { id: 'v-1', name: 'Acme', contact: null, taxId: null },
      approvedBy: { id: 'admin-1', name: 'Admin' },
    };
    prisma.vendorBill.findUnique.mockResolvedValue(approved);
    glPosting.postVendorBillPaid.mockResolvedValue('journal-1');
    prisma.vendorBill.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...approved,
        status: VendorBillStatus.PAID,
        paidAt: data.paidAt,
        glJournalEntryId: data.glJournalEntryId,
        dueDate: new Date('2026-02-01'),
        billDate: new Date('2026-01-01'),
      }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    const result = await svc.markPaid(manager(), 'bill-1');
    expect(result.status).toBe('PAID');
    expect(glPosting.postVendorBillPaid).toHaveBeenCalled();
  });

  it('blocks editing non-draft bills', async () => {
    prisma.vendorBill.findUnique.mockResolvedValue({
      id: 'bill-1',
      condoId: 'condo-1',
      status: VendorBillStatus.APPROVED,
      vendor: { id: 'v-1', name: 'Acme', contact: null, taxId: null },
      approvedBy: null,
    });

    await expect(svc.update(manager(), 'bill-1', { amount: 300 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
