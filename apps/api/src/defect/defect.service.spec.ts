import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectStatus, RoleId } from '@prisma/client';
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
      svc.transition('d1', actor, { status: DefectStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('allows one-click mark fixed from submitted to waiting resident sign-off', async () => {
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
    await svc.transition('d1', actor, { status: DefectStatus.RESOLVED });
    expect(tx.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DefectStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'defect.updated',
      expect.objectContaining({ statusFrom: DefectStatus.NEW, statusTo: DefectStatus.RESOLVED }),
    );
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

describe('DefectService.exportCondoPdf', () => {
  function exportService(defects: Array<Record<string, unknown>>) {
    const prisma = {
      condo: { findUnique: vi.fn(async () => ({ id: 'c1', name: 'Acacia Residence' })) },
      defect: { findMany: vi.fn(async () => defects) },
    } as unknown as PrismaService;
    const events = { emit: vi.fn() } as unknown as EventEmitter2;
    return { svc: new DefectService(prisma, events), prisma };
  }

  const mgmtUser = {
    id: 'admin-1',
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'c1' }],
  } as unknown as AuthenticatedUser;
  const residentUser = {
    id: 'res-1',
    roles: [{ roleId: RoleId.UNIT_OWNER, condoId: 'c1' }],
  } as unknown as AuthenticatedUser;

  it('forbids non-management users', async () => {
    const { svc } = exportService([]);
    await expect(svc.exportCondoPdf(residentUser, 'c1', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a PDF buffer ordered earliest-first for management', async () => {
    const { svc, prisma } = exportService([
      {
        id: '11111111-2222-3333-4444-555555555555',
        title: 'Leaking pipe',
        description: 'Water under the sink',
        severity: 'HIGH',
        status: DefectStatus.NEW,
        category: 'Plumbing',
        unit: { identifier: 'A-12-03', block: { name: 'Block A' } },
      },
    ]);
    const { buffer, filename } = await svc.exportCondoPdf(mgmtUser, 'c1', {
      severity: 'HIGH',
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(filename).toContain('defects-');
    expect(filename.endsWith('.pdf')).toBe(true);
    expect(prisma.defect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
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
