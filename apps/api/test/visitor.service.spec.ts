import { describe, expect, it, vi } from 'vitest';
import { VisitorService } from '../src/visitor/visitor.service';

function service() {
  const prisma: any = {
    unit: { findUnique: vi.fn() },
    visitor: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
  };
  const events: any = { emit: vi.fn() };
  return { svc: new VisitorService(prisma, events), prisma, events };
}

describe('VisitorService', () => {
  it('creates an APPROVED visitor with a deterministic QR for unit residents', async () => {
    const { svc, prisma } = service();
    prisma.unit.findUnique.mockResolvedValueOnce({ id: 'u1', condoId: 'c1' });
    prisma.visitor.create.mockImplementation(async (args: any) => ({ id: 'v1', ...args.data }));
    const v = await svc.create(
      {
        unitId: 'u1',
        name: 'Jane Doe',
        expectedAt: new Date().toISOString(),
      },
      'host-user',
    );
    expect((v as any).qrCode).toBeTypeOf('string');
    expect((v as any).status).toBe('APPROVED');
  });

  it('emits a domain event on check-in', async () => {
    const { svc, prisma, events } = service();
    prisma.visitor.findFirst.mockResolvedValueOnce({ id: 'v1', status: 'APPROVED', condoId: 'c1' });
    prisma.visitor.update.mockResolvedValueOnce({
      id: 'v1',
      status: 'CHECKED_IN',
      condoId: 'c1',
    });
    await svc.checkIn('qrcode', { gateLocation: 'main' });
    expect(events.emit).toHaveBeenCalledWith(
      expect.stringMatching(/visitor\.checked_in/),
      expect.any(Object),
    );
  });
});
