import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitorBlacklistBlockedError, VisitorBlacklistService } from '../src/visitor/visitor-blacklist.service';

function service() {
  const prisma: any = {
    visitorBlacklist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  return { svc: new VisitorBlacklistService(prisma), prisma };
}

describe('VisitorBlacklistService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks walk-in when phone matches an active entry', async () => {
    const { svc, prisma } = service();
    prisma.visitorBlacklist.findFirst.mockResolvedValue({
      id: 'bl-1',
      reason: 'Repeated trespassing',
    });

    await expect(
      svc.assertNotBlacklisted('c1', { phone: '0123456789', name: 'Encik Razak' }),
    ).rejects.toThrow(VisitorBlacklistBlockedError);

    expect(prisma.visitorBlacklist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          condoId: 'c1',
          active: true,
        }),
      }),
    );
  });

  it('allows when no identifiers match', async () => {
    const { svc, prisma } = service();
    prisma.visitorBlacklist.findFirst.mockResolvedValue(null);

    await expect(
      svc.assertNotBlacklisted('c1', { phone: '+60198765432' }),
    ).resolves.toBeUndefined();
  });

  it('creates entry with normalized phone and plate', async () => {
    const { svc, prisma } = service();
    prisma.visitorBlacklist.create.mockResolvedValue({ id: 'bl-1' });

    const user: any = { id: 'admin-1', activeRole: 'MANAGEMENT_ADMIN' };
    await svc.create('c1', user, {
      name: 'Encik Razak',
      phone: '012-345 6789',
      vehiclePlate: 'abc 1234',
      reason: 'Banned by JMB',
    });

    expect(prisma.visitorBlacklist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+60123456789',
          vehiclePlate: 'ABC1234',
        }),
      }),
    );
  });
});
