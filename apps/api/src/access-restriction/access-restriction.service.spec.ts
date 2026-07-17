import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { InvoiceStatus, RoleId } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccessRestrictedArrearsError,
  AccessRestrictionService,
  verifyAccessRestrictionSignature,
} from './access-restriction.service';

const CONDO = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';

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

describe('verifyAccessRestrictionSignature', () => {
  it('accepts a matching HMAC signature', () => {
    const body = '{"event":"unit.restricted"}';
    const secret = 'test-secret';
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyAccessRestrictionSignature(body, secret, sig)).toBe(true);
  });

  it('rejects a bad signature', () => {
    expect(verifyAccessRestrictionSignature('{}', 'secret', 'sha256=deadbeef')).toBe(false);
  });
});

describe('AccessRestrictionService.assertUnitNotAccessRestricted', () => {
  let prisma: {
    unit: { findUnique: ReturnType<typeof vi.fn> };
    condo: { findUnique: ReturnType<typeof vi.fn> };
    unitAccessRestriction: { findUnique: ReturnType<typeof vi.fn> };
  };
  let svc: AccessRestrictionService;

  beforeEach(() => {
    prisma = {
      unit: { findUnique: vi.fn() },
      condo: { findUnique: vi.fn() },
      unitAccessRestriction: { findUnique: vi.fn() },
    };
    svc = new AccessRestrictionService(prisma as unknown as PrismaService);
  });

  it('allows management bypass', async () => {
    await expect(
      svc.assertUnitNotAccessRestricted(admin(), UNIT, 'facility'),
    ).resolves.toBeUndefined();
    expect(prisma.unit.findUnique).not.toHaveBeenCalled();
  });

  it('throws when unit is actively restricted and soft-block is on', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: UNIT, condoId: CONDO });
    prisma.condo.findUnique.mockResolvedValue({
      settings: {
        accessRestriction: {
          enabled: true,
          softBlockFacility: true,
          softBlockVisitors: true,
          softBlockDeliveryPasses: true,
          softBlockRecurringPasses: true,
        },
      },
    });
    prisma.unitAccessRestriction.findUnique.mockResolvedValue({ active: true });

    await expect(
      svc.assertUnitNotAccessRestricted(owner(), UNIT, 'facility'),
    ).rejects.toBeInstanceOf(AccessRestrictedArrearsError);
  });

  it('skips when policy disabled', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: UNIT, condoId: CONDO });
    prisma.condo.findUnique.mockResolvedValue({
      settings: { accessRestriction: { enabled: false } },
    });
    await expect(
      svc.assertUnitNotAccessRestricted(owner(), UNIT, 'facility'),
    ).resolves.toBeUndefined();
    expect(prisma.unitAccessRestriction.findUnique).not.toHaveBeenCalled();
  });
});

describe('AccessRestrictionService.recomputeCondo', () => {
  it('activates AUTO when arrears exceed grace days', async () => {
    const due = new Date();
    due.setDate(due.getDate() - 20);
    const upsert = vi.fn(async ({ create }: { create: unknown }) => ({
      ...(create as object),
      unit: { identifier: 'A-1', block: { name: 'A' } },
    }));
    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({
          id: CONDO,
          deletedAt: null,
          settings: {
            accessRestriction: {
              enabled: true,
              graceDays: 14,
              minOutstanding: 0.01,
              zones: ['CAR_PARK', 'AMENITIES'],
              autoSyncEnabled: false,
            },
          },
        })),
      },
      invoice: {
        findMany: vi.fn(async () => [
          {
            unitId: UNIT,
            total: 100,
            amountPaid: 0,
            dueDate: due,
            status: InvoiceStatus.OVERDUE,
          },
        ]),
      },
      unitAccessRestriction: {
        findMany: vi.fn(async () => []),
        upsert,
        update: vi.fn(),
      },
    };
    const svc = new AccessRestrictionService(prisma as unknown as PrismaService);
    const result = await svc.recomputeCondo(CONDO, 'admin-1');
    expect(result.activated).toBe(1);
    expect(upsert).toHaveBeenCalled();
  });

  it('respects manualExempt and does not auto-activate', async () => {
    const due = new Date();
    due.setDate(due.getDate() - 40);
    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({
          id: CONDO,
          deletedAt: null,
          settings: {
            accessRestriction: {
              enabled: true,
              graceDays: 14,
              minOutstanding: 0.01,
              zones: ['CAR_PARK'],
              autoSyncEnabled: false,
            },
          },
        })),
      },
      invoice: {
        findMany: vi.fn(async () => [
          { unitId: UNIT, total: 200, amountPaid: 0, dueDate: due, status: InvoiceStatus.OVERDUE },
        ]),
      },
      unitAccessRestriction: {
        findMany: vi.fn(async () => [
          {
            unitId: UNIT,
            condoId: CONDO,
            active: false,
            manualExempt: true,
            source: 'MANUAL',
            outstandingAmount: 0,
            oldestDueDate: null,
            clearedAt: null,
            reason: 'Cleared by management',
            updatedByUserId: null,
          },
        ]),
        update: vi.fn(async () => ({})),
        upsert: vi.fn(),
      },
    };
    const svc = new AccessRestrictionService(prisma as unknown as PrismaService);
    const result = await svc.recomputeCondo(CONDO);
    expect(result.activated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prisma.unitAccessRestriction.upsert).not.toHaveBeenCalled();
  });
});
