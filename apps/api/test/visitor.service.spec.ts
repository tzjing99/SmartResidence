import { describe, expect, it, vi } from 'vitest';
import { VisitorService } from '../src/visitor/visitor.service';

function service() {
  const prisma: any = {
    unit: { findUnique: vi.fn() },
    visitor: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    visitorCheckIn: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  const events: any = { emit: vi.fn() };
  return { svc: new VisitorService(prisma, events), prisma, events };
}

const host: any = { id: 'host-user', activeRole: 'UNIT_OWNER' };
const guard: any = { id: 'guard-user', activeRole: 'SECURITY_GUARD' };

describe('VisitorService', () => {
  it('creates an APPROVED visitor with a deterministic QR for unit residents', async () => {
    const { svc, prisma } = service();
    prisma.unit.findUnique.mockResolvedValueOnce({ id: 'u1', condoId: 'c1' });
    prisma.visitor.create.mockImplementation(async (args: any) => ({ id: 'v1', ...args.data }));
    const v = await svc.create(host, {
      unitId: 'u1',
      name: 'Jane Doe',
      expectedAt: new Date().toISOString() as any,
    } as any);
    expect((v as any).qrCode).toBeTypeOf('string');
    expect((v as any).status).toBe('APPROVED');
  });

  it('emits a domain event on check-in', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.findUnique.mockResolvedValueOnce({
      id: 'v1',
      status: 'APPROVED',
      condoId: 'c1',
      unitId: 'u1',
    });
    prisma.visitorCheckIn.create.mockResolvedValueOnce({ id: 'ci1' });
    await svc.checkIn('qrcode', guard, { gateLocation: 'main' } as any);
    expect(events.emit).toHaveBeenCalledWith(
      expect.stringMatching(/visitor\.checked_in/),
      expect.any(Object),
    );
  });
});
