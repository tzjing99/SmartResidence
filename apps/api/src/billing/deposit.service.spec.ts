import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DepositStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositService } from './deposit.service';
import type { ReceiptService } from './receipt.service';

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

function resident(): AuthenticatedUser {
  return {
    id: 'owner-1',
    email: 'o@b.c',
    name: 'Owner',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: 'unit-1', permissions: [] }],
  };
}

function makeService(
  prisma: Partial<PrismaService>,
  issueInTx = vi.fn(async () => ({ id: 'rcpt-1' })),
) {
  const events = { emit: vi.fn() };
  const receipts = { issueInTx } as unknown as ReceiptService;
  const ledger = {
    record: vi.fn(async () => ({})),
  } as unknown as import('./ledger.service').LedgerService;
  const svc = new DepositService(
    prisma as PrismaService,
    events as unknown as EventEmitter2,
    receipts,
    ledger,
  );
  return { svc, events, issueInTx };
}

describe('DepositService.record', () => {
  it('records a deposit, issues a receipt, audits and emits', async () => {
    const tx = {
      deposit: { create: vi.fn(async () => ({ id: 'dep-1', currencyCode: 'MYR' })) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      unit: { findUnique: vi.fn(async () => ({ id: 'unit-1', condoId: CONDO })) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
      deposit: {
        findUnique: vi.fn(async () => ({
          id: 'dep-1',
          condoId: CONDO,
          unitId: 'unit-1',
          userId: null,
        })),
      },
    } as unknown as PrismaService;
    const { svc, events, issueInTx } = makeService(prisma);

    await svc.record(admin(), { unitId: 'unit-1', type: 'RENOVATION', amount: 1000 });

    expect(tx.deposit.create).toHaveBeenCalled();
    expect(issueInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ kind: 'DEPOSIT', amount: 1000 }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('deposit.recorded', expect.any(Object));
  });

  it('rejects a non-management actor', async () => {
    const prisma = {
      unit: { findUnique: vi.fn(async () => ({ id: 'unit-1', condoId: CONDO })) },
    } as unknown as PrismaService;
    const { svc } = makeService(prisma);
    await expect(
      svc.record(resident(), { unitId: 'unit-1', type: 'RENOVATION', amount: 1000 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('DepositService.refund', () => {
  const baseDeposit = {
    id: 'dep-1',
    condoId: CONDO,
    unitId: 'unit-1',
    userId: 'owner-1',
    type: 'RENOVATION',
    amount: 1000,
    refundedAmount: 0,
    forfeitedAmount: 0,
    currencyCode: 'MYR',
    refundedAt: null,
  };

  it('records a partial refund (status PARTIALLY_REFUNDED) and issues a refund receipt', async () => {
    const tx = {
      deposit: { update: vi.fn(async () => ({})) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      deposit: { findUnique: vi.fn(async () => baseDeposit) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const { svc, issueInTx } = makeService(prisma);

    await svc.refund(admin(), 'dep-1', { amount: 400 });

    expect(tx.deposit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundedAmount: 400,
          status: DepositStatus.PARTIALLY_REFUNDED,
        }),
      }),
    );
    expect(issueInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ kind: 'REFUND', amount: 400 }),
    );
  });

  it('forfeits without issuing a refund receipt and marks FORFEITED', async () => {
    const tx = {
      deposit: { update: vi.fn(async () => ({})) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      deposit: { findUnique: vi.fn(async () => baseDeposit) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const { svc, issueInTx } = makeService(prisma);

    await svc.refund(admin(), 'dep-1', { forfeit: true });

    expect(tx.deposit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          forfeitedAmount: 1000,
          status: DepositStatus.FORFEITED,
        }),
      }),
    );
    expect(issueInTx).not.toHaveBeenCalled();
  });

  it('rejects a refund that exceeds the held balance', async () => {
    const prisma = {
      deposit: { findUnique: vi.fn(async () => baseDeposit) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const { svc } = makeService(prisma);
    await expect(svc.refund(admin(), 'dep-1', { amount: 2000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
