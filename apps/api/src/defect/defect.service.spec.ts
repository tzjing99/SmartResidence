import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DefectService } from './defect.service';

const actor = { id: 'staff-1' } as AuthenticatedUser;

function makeService(defect: Record<string, unknown> | null) {
  const tx = {
    defect: { update: vi.fn(async (args: { data: unknown }) => ({ id: 'd1', ...args.data })) },
    defectUpdate: {
      create: vi.fn(async () => ({ id: 'u1' })),
      findUnique: vi.fn(async () => ({ id: 'u1', author: { id: 'staff-1' }, attachments: [] })),
    },
    attachment: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    defect: { findUnique: vi.fn(async () => defect) },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  } as unknown as PrismaService;
  const events = { emit: vi.fn() } as unknown as EventEmitter2;
  const svc = new DefectService(prisma, events);
  return { svc, prisma, events, tx };
}

describe('DefectService.transition', () => {
  it('rejects an illegal transition', async () => {
    const { svc, events } = makeService({
      id: 'd1',
      condoId: 'c1',
      status: DefectStatus.NEW,
      raisedByUserId: 'r1',
    });
    await expect(
      svc.transition('d1', actor, { status: DefectStatus.RESOLVED }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('writes a timeline entry and emits an enriched event on a valid transition', async () => {
    const { svc, events, tx } = makeService({
      id: 'd1',
      condoId: 'c1',
      status: DefectStatus.NEW,
      raisedByUserId: 'r1',
      assignedToUserId: null,
      acknowledgedAt: null,
      resolvedAt: null,
      closedAt: null,
    });
    await svc.transition('d1', actor, { status: DefectStatus.ACK });
    expect(tx.defectUpdate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusFrom: DefectStatus.NEW, statusTo: DefectStatus.ACK }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'defect.updated',
      expect.objectContaining({
        defectId: 'd1',
        statusFrom: DefectStatus.NEW,
        statusTo: DefectStatus.ACK,
        actorUserId: 'staff-1',
      }),
    );
  });

  it('flags an assignment change when assignedToUserId differs', async () => {
    const { svc, events } = makeService({
      id: 'd1',
      condoId: 'c1',
      status: DefectStatus.ACK,
      raisedByUserId: 'r1',
      assignedToUserId: null,
      acknowledgedAt: null,
      resolvedAt: null,
      closedAt: null,
    });
    await svc.transition('d1', actor, {
      status: DefectStatus.ASSIGNED,
      assignedToUserId: 'mgr-9',
    });
    expect(events.emit).toHaveBeenCalledWith(
      'defect.updated',
      expect.objectContaining({ assigneeChanged: true, assignedToUserId: 'mgr-9' }),
    );
  });
});

describe('DefectService.addUpdate', () => {
  it('commits attachments and emits a comment event', async () => {
    const { svc, events, tx } = makeService({
      id: 'd1',
      condoId: 'c1',
      status: DefectStatus.ASSIGNED,
      raisedByUserId: 'r1',
    });
    await svc.addUpdate('d1', actor, { message: 'On it', attachmentIds: ['a1'] });
    expect(tx.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ defectUpdateId: 'u1' }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'defect.commented',
      expect.objectContaining({ defectId: 'd1', authorUserId: 'staff-1', isInternal: false }),
    );
  });
});
