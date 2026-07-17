import type { AccessRestrictionService } from '@/access-restriction/access-restriction.service';
import type { BillingService } from '@/billing/billing.service';
import type { DepositService } from '@/billing/deposit.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BookingService } from './booking.service';

const CONDO = 'condo-1';

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

const FACILITY = {
  id: 'fac-1',
  condoId: CONDO,
  name: 'Function Hall',
  active: true,
  requiresApproval: false,
  bookingFee: null,
  depositAmount: null,
  openTime: '08:00',
  closeTime: '22:00',
  slotMinutes: 60,
  maxConcurrent: 1,
};

/** Tomorrow at the given hour (safely in the future and inside 08:00–22:00). */
function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function makeService(overlappingCount: number, maxConcurrent = 1) {
  const tx = {
    booking: {
      count: vi.fn(async () => overlappingCount),
      create: vi.fn(async () => ({
        id: 'book-1',
        condoId: CONDO,
        userId: 'owner-1',
        status: BookingStatus.CONFIRMED,
        invoiceId: null,
        depositId: null,
        startAt: tomorrowAt(10),
        endAt: tomorrowAt(11),
      })),
      update: vi.fn(async () => ({})),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    facility: { findUnique: vi.fn(async () => ({ ...FACILITY, maxConcurrent })) },
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    booking: {
      findUnique: vi.fn(async () => ({
        id: 'book-1',
        condoId: CONDO,
        userId: 'owner-1',
        status: BookingStatus.CONFIRMED,
        facility: { id: 'fac-1', name: 'Function Hall' },
        unit: null,
        user: { id: 'owner-1', name: 'Owner' },
      })),
    },
  } as unknown as PrismaService;
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const billing = {
    createInvoiceInTx: vi.fn(),
    voidUnpaidInvoiceInTx: vi.fn(),
  } as unknown as BillingService;
  const deposits = { recordInTx: vi.fn(), refundHeldInTx: vi.fn() } as unknown as DepositService;
  const accessRestriction = {
    assertUnitNotAccessRestricted: vi.fn(async () => undefined),
  } as unknown as AccessRestrictionService;
  const svc = new BookingService(prisma, events, billing, deposits, accessRestriction);
  return { svc, tx, events };
}

describe('BookingService.create — double-booking prevention', () => {
  const dto = { facilityId: 'fac-1', startAt: tomorrowAt(10), endAt: tomorrowAt(11) };

  it('rejects an overlapping booking once maxConcurrent is reached', async () => {
    const { svc } = makeService(1, 1);
    await expect(svc.create(resident(), dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a booking when the slot is free', async () => {
    const { svc, tx, events } = makeService(0, 1);
    await svc.create(resident(), dto);
    expect(tx.booking.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('booking.created', expect.any(Object));
  });

  it('allows a concurrent booking below maxConcurrent (e.g. multiple BBQ pits)', async () => {
    const { svc, tx } = makeService(1, 2);
    await svc.create(resident(), dto);
    expect(tx.booking.create).toHaveBeenCalled();
  });
});
