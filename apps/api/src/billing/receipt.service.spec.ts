import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import type { StorageService } from '@/storage/storage.service';
import { RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptService } from './receipt.service';

const CONDO = 'condo-1';

function admin(): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'a@b.c',
    name: 'Admin',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

describe('ReceiptService.getPdf', () => {
  it('does not duplicate block prefixes in receipt PDF unit labels', async () => {
    const prisma = {
      receipt: {
        findUnique: vi.fn(async () => ({
          id: 'receipt-1',
          condoId: CONDO,
          number: 'RCPT-2026-000001',
          kind: 'PAYMENT',
          amount: 100,
          currencyCode: 'MYR',
          issuedToUserId: null,
          unitId: 'unit-1',
          description: 'Payment for invoice INV-1',
          issuedAt: new Date('2026-06-30T00:00:00.000Z'),
          templateSnapshot: {},
          pdfKey: null,
          unit: { identifier: 'A-04-3', block: { name: 'A' } },
          issuedTo: null,
          payment: null,
          deposit: null,
        })),
        update: vi.fn(async () => ({})),
      },
    } as unknown as PrismaService;
    const storage = {
      putObject: vi.fn(async () => {}),
    } as unknown as StorageService;
    const svc = new ReceiptService(prisma, storage);

    const { buffer } = await svc.getPdf(admin(), 'receipt-1');
    const pdf = buffer.toString('utf8');

    expect(pdf).toContain('(A-04-3)');
    expect(pdf).not.toContain('(A-A-04-3)');
  });

  it('renders deposit receipts with deposit-specific sections and summary', async () => {
    const prisma = {
      receipt: {
        findUnique: vi.fn(async () => ({
          id: 'receipt-2',
          condoId: CONDO,
          number: 'RCPT-2026-000002',
          kind: 'DEPOSIT',
          amount: 500,
          currencyCode: 'MYR',
          issuedToUserId: 'user-1',
          unitId: 'unit-1',
          description: 'Renovation deposit',
          issuedAt: new Date('2026-06-30T00:00:00.000Z'),
          templateSnapshot: {},
          pdfKey: null,
          unit: { identifier: '04-3', block: { name: 'A' } },
          issuedTo: { id: 'user-1', name: 'Jane Tan' },
          payment: null,
          deposit: {
            type: 'RENOVATION',
            amount: 500,
            currencyCode: 'MYR',
            status: 'HELD',
            method: 'Bank transfer',
            reference: 'TXN-123',
            refundedAmount: 0,
            forfeitedAmount: 0,
            paidAt: new Date('2026-06-29T00:00:00.000Z'),
            notes: 'Renovation works — kitchen',
            user: { id: 'user-1', name: 'Jane Tan' },
          },
        })),
        update: vi.fn(async () => ({})),
      },
    } as unknown as PrismaService;
    const storage = {
      putObject: vi.fn(async () => {}),
    } as unknown as StorageService;
    const svc = new ReceiptService(prisma, storage);

    const { buffer } = await svc.getPdf(admin(), 'receipt-2');
    const pdf = buffer.toString('utf8');

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf).toContain('DEPOSIT DETAILS');
    expect(pdf).toContain('DEPOSIT SUMMARY');
    expect(pdf).toContain('DEPOSIT RECEIVED');
    expect(pdf).toContain('Renovation deposit');
    expect(pdf).toContain('Bank transfer');
    expect(pdf).toContain('TXN-123');
    expect(pdf).toContain('Held');
    expect(pdf).toContain('(A-04-3)');
    expect(pdf).not.toContain('PAYMENT DETAILS');
    expect(pdf).not.toContain('AMOUNT RECEIVED');
  });
});
