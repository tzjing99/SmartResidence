import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnnouncementAudienceScope } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AnnouncementService } from '../src/announcement/announcement.service';

function service() {
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const prisma: any = {
    announcement: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    announcementRead: { upsert: vi.fn() },
    announcementBlock: { deleteMany: vi.fn(), createMany: vi.fn() },
    announcementUnit: { deleteMany: vi.fn(), createMany: vi.fn() },
    announcementAck: { upsert: vi.fn() },
    attachment: { updateMany: vi.fn() },
    unit: { findMany: vi.fn() },
    ownership: { findMany: vi.fn() },
    tenancy: { findMany: vi.fn() },
    householdMember: { findMany: vi.fn() },
    $transaction: vi.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops(prisma))),
  };
  return { svc: new AnnouncementService(prisma, events), prisma, events };
}

const resident: any = {
  id: 'u1',
  roles: [{ roleId: 'UNIT_OWNER', condoId: 'c1', unitId: 'unit1' }],
};

const manager: any = {
  id: 'm1',
  roles: [{ roleId: 'MANAGEMENT_ADMIN', condoId: 'c1', unitId: null }],
};

describe('AnnouncementService', () => {
  it('excludes drafts from resident inbox', async () => {
    const { svc, prisma } = service();
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit1', blockId: 'b1' }]);
    prisma.announcement.findMany.mockResolvedValue([]);
    prisma.announcement.count.mockResolvedValue(0);

    await svc.list(resident, 'c1', { limit: 20, offset: 0 });

    const where = prisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.publishedAt).toEqual({ not: null, lte: expect.any(Date) });
    expect(where.deletedAt).toBeNull();
  });

  it('counts unread announcements in list response', async () => {
    const { svc, prisma } = service();
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit1', blockId: 'b1' }]);
    prisma.announcement.findMany.mockResolvedValue([
      {
        id: 'a1',
        condoId: 'c1',
        title: 'Hello',
        body: 'Body',
        category: 'NOTICE',
        importance: 'INFO',
        audienceScope: 'CONDO',
        publishedAt: new Date('2026-01-01'),
        expiresAt: null,
        requiresAck: false,
        pinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 'm1', name: 'Mgmt' },
        attachments: [],
        audienceBlocks: [],
        audienceUnits: [],
        reads: [],
        _count: { acks: 0, reads: 0 },
      },
    ]);
    prisma.announcement.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await svc.list(resident, 'c1', { limit: 20, offset: 0 });
    expect(result.unreadCount).toBe(1);
    expect(result.items[0].readAt).toBeNull();
  });

  it('filters audience to resident units/blocks/condo', async () => {
    const { svc, prisma } = service();
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit1', blockId: 'b1' }]);
    prisma.announcement.findMany.mockResolvedValue([]);
    prisma.announcement.count.mockResolvedValue(0);

    await svc.list(resident, 'c1', { limit: 10, offset: 0 });

    const where = prisma.announcement.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { audienceScope: AnnouncementAudienceScope.CONDO },
        {
          audienceScope: AnnouncementAudienceScope.BLOCKS,
          audienceBlocks: { some: { blockId: { in: ['b1'] } } },
        },
        {
          audienceScope: AnnouncementAudienceScope.UNITS,
          audienceUnits: { some: { unitId: { in: ['unit1'] } } },
        },
      ]),
    );
  });

  it('rejects audience changes after publish', async () => {
    const { svc, prisma } = service();
    prisma.announcement.findFirst.mockResolvedValue({
      id: 'a1',
      condoId: 'c1',
      publishedAt: new Date('2026-01-01'),
      audienceScope: 'CONDO',
    });

    await expect(
      svc.update(manager, 'a1', {
        audienceScope: AnnouncementAudienceScope.UNITS,
        unitIds: ['unit1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes announcements for management', async () => {
    const { svc, prisma } = service();
    prisma.announcement.findFirst.mockResolvedValue({ id: 'a1', condoId: 'c1' });
    prisma.announcement.update.mockResolvedValue({ id: 'a1' });

    const result = await svc.softDelete(manager, 'a1');
    expect(result.deleted).toBe(true);
    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });

  it('throws when announcement is missing on getOne', async () => {
    const { svc, prisma } = service();
    prisma.announcement.findFirst.mockResolvedValue(null);
    await expect(svc.getOne(resident, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
