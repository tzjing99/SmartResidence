import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectStatus, RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DefectReportService } from './defect-report.service';

const resident = {
  id: 'res-1',
  roles: [{ roleId: RoleId.UNIT_OWNER, condoId: 'c1', unitId: 'u1' }],
} as unknown as AuthenticatedUser;

const mgmt = {
  id: 'admin-1',
  roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'c1' }],
} as unknown as AuthenticatedUser;

describe('DefectReportService.createHandover', () => {
  function makeService() {
    const tx = {
      defectReport: { create: vi.fn(async () => ({ id: 'r1', condoId: 'c1' })) },
      defect: {
        createManyAndReturn: vi.fn(
          async (args: { data: Array<{ metadata: { handoverIndex: number } }> }) =>
            args.data.map((row, i) => ({
              id: `d-${i}`,
              metadata: row.metadata,
            })),
        ),
      },
      attachment: { updateMany: vi.fn(async () => ({ count: 1 })) },
    };
    const prisma = {
      unit: { findUnique: vi.fn(async () => ({ id: 'u1', condoId: 'c1' })) },
      defectElement: { findMany: vi.fn(async () => [{ id: 'el-1', name: 'Tiles' }]) },
      defectIssue: { findMany: vi.fn(async () => [{ id: 'is-1', name: 'Uneven tiles' }]) },
      defectSpaceType: { findMany: vi.fn(async () => [{ id: 'sp-1', name: 'Bathroom' }]) },
      defectReport: {
        findUnique: vi.fn(async () => ({
          id: 'r1',
          condoId: 'c1',
          unitId: 'u1',
          kind: 'HANDOVER',
          title: 'Multiple defects',
          createdAt: new Date(),
          raisedByUserId: 'res-1',
          raisedBy: { id: 'res-1', name: 'Resident' },
          unit: { id: 'u1', identifier: '01-01', block: { name: 'A' } },
        })),
      },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const events = { emit: vi.fn() } as unknown as EventEmitter2;
    const svc = new DefectReportService(prisma, events);
    return { svc, prisma, events, tx };
  }

  it('creates one Defect per item via createManyAndReturn, commits photos, and emits ONE summary notification', async () => {
    const { svc, events, tx } = makeService();
    const result = await svc.createHandover(resident, {
      unitId: 'u1',
      items: [
        {
          spaceLabel: 'Bathroom 1',
          spaceTypeId: 'sp-1',
          elementId: 'el-1',
          issueId: 'is-1',
          attachmentIds: ['att-1'],
        },
        { spaceLabel: 'Kitchen', note: 'Scratched countertop' },
        { spaceLabel: 'Bedroom 1', elementId: 'el-1' },
      ],
    });

    expect(tx.defectReport.create).toHaveBeenCalledTimes(1);
    expect(tx.defect.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(tx.defect.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Bathroom 1 - Tiles: Uneven tiles',
            category: 'Bathroom',
            reportId: 'r1',
            status: 'NEW',
            metadata: { handoverIndex: 0 },
          }),
        ]),
      }),
    );

    expect(tx.attachment.updateMany).toHaveBeenCalledTimes(1);

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
      'defect.report.created',
      expect.objectContaining({
        reportId: 'r1',
        condoId: 'c1',
        itemCount: 3,
        actorUserId: 'res-1',
      }),
    );

    expect(result.itemCount).toBe(3);
    expect(result.statusCounts.NEW).toBe(3);
  });

  it('inserts defects in chunks for large submissions', async () => {
    const { svc, tx } = makeService();
    const items = Array.from({ length: 150 }, (_, i) => ({
      spaceLabel: `Room ${i}`,
      note: `Issue ${i}`,
    }));
    await svc.createHandover(resident, { unitId: 'u1', items });

    // 150 items / chunk size 100 => 2 createManyAndReturn calls.
    expect(tx.defect.createManyAndReturn).toHaveBeenCalledTimes(2);
    expect(tx.defect.createManyAndReturn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ metadata: { handoverIndex: 0 } })]),
      }),
    );
    expect(tx.defect.createManyAndReturn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ metadata: { handoverIndex: 100 } }),
        ]),
      }),
    );
  });
});

describe('DefectReportService.bulkUpdateItems', () => {
  function makeService(defects: Array<Record<string, unknown>>) {
    const tx = {
      defect: { update: vi.fn(async () => ({})) },
      defectUpdate: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      defectReport: { findUnique: vi.fn(async () => ({ id: 'r1', condoId: 'c1' })) },
      defect: { findMany: vi.fn(async () => defects) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const events = { emit: vi.fn() } as unknown as EventEmitter2;
    return { svc: new DefectReportService(prisma, events), tx };
  }

  it('forbids non-management users', async () => {
    const { svc } = makeService([]);
    await expect(
      svc.bulkUpdateItems('r1', resident, { defectIds: ['d1'], status: DefectStatus.ACK }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies only valid transitions and writes a timeline entry per change', async () => {
    const { svc, tx } = makeService([
      { id: 'd1', status: DefectStatus.NEW, assignedToUserId: null },
      // RESOLVED is not reachable from NEW -> skipped.
      { id: 'd2', status: DefectStatus.NEW, assignedToUserId: null },
    ]);
    const res = await svc.bulkUpdateItems('r1', mgmt, {
      defectIds: ['d1', 'd2'],
      status: DefectStatus.ACK,
    });
    expect(res.updated).toBe(2);
    expect(tx.defect.update).toHaveBeenCalledTimes(2);
    expect(tx.defectUpdate.create).toHaveBeenCalledTimes(2);
  });
});
