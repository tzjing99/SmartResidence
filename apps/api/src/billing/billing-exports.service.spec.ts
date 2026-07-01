import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BillingExportsService } from './billing-exports.service';
import type { LedgerService } from './ledger.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';

function manager(): AuthenticatedUser {
  return {
    id: 'mgr-1',
    email: 'm@b.c',
    name: 'Manager',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO, unitId: null, permissions: [] }],
  };
}

function owner(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

function makeService() {
  const ledger = {
    unitStatementInRange: vi.fn(async () => ({
      openingBalance: 100,
      closingBalance: 40,
      creditBalance: 0,
      entries: [
        {
          occurredAt: '2026-01-10T00:00:00.000Z',
          type: 'PAYMENT',
          fund: 'MAINTENANCE',
          description: 'Payment for INV-1',
          charge: 0,
          payment: 60,
          balance: 40,
        },
      ],
    })),
    collectionsSummary: vi.fn(async () => ({
      total: 500,
      count: 2,
      byFund: [{ fund: 'MAINTENANCE', balance: 500 }],
    })),
    collectionsExportRows: vi.fn(async () => [
      {
        occurredAt: '2026-01-15T00:00:00.000Z',
        unitLabel: 'A-01-1',
        fund: 'MAINTENANCE',
        type: 'PAYMENT',
        description: 'Online payment',
        amount: 250,
        sourceRef: 'PAY-1',
      },
    ]),
    arrearsAging: vi.fn(async () => ({
      totalOutstanding: 300,
      unitsInArrears: 1,
      invoicesInArrears: 2,
      buckets: [{ bucket: 'DAYS_1_30', count: 2, amount: 300 }],
    })),
    arrearsExportRows: vi.fn(async () => [
      {
        unitLabel: 'A-01-1',
        invoiceNumber: 'INV-001',
        dueDate: '2026-01-01T00:00:00.000Z',
        daysOverdue: 15,
        bucket: 'DAYS_1_30',
        total: 200,
        amountPaid: 0,
        outstanding: 200,
      },
    ]),
  } as unknown as LedgerService;

  const prisma = {
    condo: {
      findUnique: vi.fn(async () => ({
        id: CONDO,
        name: 'Acacia',
        settings: { billing: { receipt: { organizationName: 'Acacia JMB' } } },
      })),
    },
    unit: {
      findUnique: vi.fn(async () => ({
        id: UNIT,
        condoId: CONDO,
        identifier: 'A-01-1',
        block: { name: 'A' },
      })),
    },
  } as unknown as PrismaService;

  return { service: new BillingExportsService(prisma, ledger), ledger, prisma };
}

describe('BillingExportsService', () => {
  it('returns a PDF buffer for unit statements', async () => {
    const { service } = makeService();
    const { buffer, filename } = await service.unitStatementPdf(manager(), CONDO, UNIT);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(filename).toMatch(/^statement-A-01-1-/);
  });

  it('builds collections CSV with header rows and detail lines', async () => {
    const { service } = makeService();
    const { csv, filename } = await service.collectionsCsv(manager(), CONDO, '2026-01-01', '2026-01-31');
    expect(filename).toMatch(/^collections-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('Collections export');
    expect(csv).toContain('Online payment');
    expect(csv).toContain('A-01-1');
  });

  it('builds arrears aging CSV with summary and invoice rows', async () => {
    const { service } = makeService();
    const { csv, filename } = await service.arrearsCsv(manager(), CONDO);
    expect(filename).toMatch(/^arrears-aging-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('Arrears aging export');
    expect(csv).toContain('INV-001');
    expect(csv).toContain('Units in arrears');
  });

  it('rejects residents from export endpoints', async () => {
    const { service } = makeService();
    await expect(service.arrearsCsv(owner(), CONDO)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
