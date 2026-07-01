import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { LostFoundKind, LostFoundStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LostFoundService } from './lost-found.service';

const CONDO = 'condo-1';
const UNIT = 'unit-1';
const USER = 'user-1';

function resident(): AuthenticatedUser {
  return {
    id: USER,
    email: 'r@b.c',
    name: 'Resident',
    locale: 'en',
    activeCondoId: CONDO,
    activeRole: RoleId.UNIT_OWNER,
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: CONDO, unitId: UNIT, permissions: [] }],
  };
}

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

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    condoId: CONDO,
    userId: USER,
    unitId: UNIT,
    kind: LostFoundKind.LOST,
    title: 'Lost keys',
    description: 'Silver house keys with blue tag',
    locationNote: 'Near pool',
    contactMethod: 'WhatsApp 012-3456789',
    status: LostFoundStatus.OPEN,
    photoAttachmentId: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: USER, name: 'Resident' },
    unit: { id: UNIT, identifier: 'A-01-01', block: { name: 'A' } },
    photoAttachment: null,
    ...overrides,
  };
}

function makeService(post = makePost()) {
  const prisma = {
    lostFoundPost: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...post,
        ...args.data,
        user: post.user,
        unit: post.unit,
        photoAttachment: post.photoAttachment,
      })),
      findUnique: vi.fn(async () => post),
      findMany: vi.fn(async () => [post]),
      count: vi.fn(async () => 1),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...post,
        ...args.data,
        user: post.user,
        unit: post.unit,
        photoAttachment: post.photoAttachment,
      })),
    },
    attachment: {
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Array<Promise<unknown>>)),
  } as unknown as PrismaService;

  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  return { service: new LostFoundService(prisma, events), prisma, events, post };
}

describe('LostFoundService', () => {
  it('creates a post and emits lostfound.created', async () => {
    const { service, events } = makeService();
    const result = await service.create(resident(), {
      condoId: CONDO,
      unitId: UNIT,
      kind: LostFoundKind.FOUND,
      title: 'Found wallet',
      description: 'Black leather wallet near lift lobby',
      contactMethod: 'Leave message at guard house',
    });
    expect(result.title).toBe('Found wallet');
    expect(events.emit).toHaveBeenCalledWith('lostfound.created', {
      postId: 'post-1',
      condoId: CONDO,
      userId: USER,
    });
  });

  it('rejects create when unit is not accessible', async () => {
    const { service } = makeService();
    await expect(
      service.create(resident(), {
        condoId: CONDO,
        unitId: 'other-unit',
        kind: LostFoundKind.LOST,
        title: 'Lost phone',
        description: 'iPhone left in gym yesterday evening',
        contactMethod: 'Call guard house',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves an open post by owner', async () => {
    const { service, events } = makeService();
    const result = await service.resolve(resident(), 'post-1');
    expect(result.status).toBe(LostFoundStatus.RESOLVED);
    expect(events.emit).toHaveBeenCalledWith('lostfound.resolved', {
      postId: 'post-1',
      condoId: CONDO,
      userId: USER,
    });
  });

  it('rejects resolve when post is not open', async () => {
    const { service } = makeService(makePost({ status: LostFoundStatus.RESOLVED }));
    await expect(service.resolve(resident(), 'post-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows owner to remove own post', async () => {
    const { service } = makeService();
    const result = await service.removeOwn(resident(), 'post-1');
    expect(result.status).toBe(LostFoundStatus.REMOVED);
  });

  it('rejects remove by non-owner', async () => {
    const { service } = makeService();
    await expect(service.removeOwn(manager(), 'post-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows management to moderate-remove', async () => {
    const { service } = makeService();
    const result = await service.moderateRemove(manager(), 'post-1');
    expect(result.status).toBe(LostFoundStatus.REMOVED);
  });

  it('lists open posts for residents by default', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.lostFoundPost.findMany).mockImplementation(async (args) => {
      expect(args?.where).toMatchObject({ condoId: CONDO, status: LostFoundStatus.OPEN });
      return [makePost()];
    });
    vi.mocked(prisma.lostFoundPost.count).mockResolvedValue(1);
    const result = await service.listForCondo(resident(), CONDO, {});
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('lets management filter by status in manage mode', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.lostFoundPost.findMany).mockImplementation(async (args) => {
      expect(args?.where).toMatchObject({ condoId: CONDO, status: LostFoundStatus.REMOVED });
      return [];
    });
    await service.listForCondo(manager(), CONDO, { manage: true, status: LostFoundStatus.REMOVED });
  });
});
