import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantService } from '../src/tenant/tenant.service';

function service() {
  const prisma: any = {
    unit: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
  return { svc: new TenantService(prisma), prisma };
}

describe('TenantService.listUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches by unit identifier, block name, and resident name', async () => {
    const { svc, prisma } = service();
    await svc.listUnits('condo-1', { limit: 20, offset: 0, search: '  Tan  ' });

    const findManyArgs = prisma.unit.findMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({
      condoId: 'condo-1',
      OR: [
        { identifier: { contains: 'Tan', mode: 'insensitive' } },
        { block: { name: { contains: 'Tan', mode: 'insensitive' } } },
        {
          ownerships: {
            some: {
              status: 'ACTIVE',
              user: { name: { contains: 'Tan', mode: 'insensitive' } },
            },
          },
        },
      ],
    });
    expect(prisma.unit.count.mock.calls[0][0].where).toEqual(findManyArgs.where);
  });

  it('lists all condo units when search is empty', async () => {
    const { svc, prisma } = service();
    await svc.listUnits('condo-1', { limit: 10, offset: 0, search: '   ' });

    expect(prisma.unit.findMany.mock.calls[0][0].where).toEqual({ condoId: 'condo-1' });
  });
});
