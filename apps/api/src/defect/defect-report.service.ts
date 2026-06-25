import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttachmentOwner,
  AttachmentStatus,
  DefectReportKind,
  type DefectStatus,
  RoleId,
} from '@prisma/client';
import {
  type DefectReportDetail,
  type DefectReportSummary,
  HANDOVER_REPORT_INSERT_CHUNK,
  HANDOVER_REPORT_ITEMS_HARD_CAP,
  defectReference,
  handoverDefectTitle,
  handoverReportTxOptions,
} from '@smartresidence/shared-types';
import { buildHandoverReportPdf } from './defect-export';
import { canTransitionDefect } from './defect-transitions';
import type { BulkUpdateReportItemsDto, CreateHandoverReportDto } from './dto/defect-report.dto';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

@Injectable()
export class DefectReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private isManagement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some(
      (r) =>
        MANAGEMENT_ROLES.includes(r.roleId) &&
        (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
    );
  }

  /**
   * Create a multi-defect report: one parent DefectReport + N full Defect rows
   * (one per item) in a transaction, committing each item's photos. Emits a
   * SINGLE `defect.report.created` event (not one notification per item).
   *
   * Supports any practical walkthrough size; resources scale with item count.
   */
  async createHandover(
    user: AuthenticatedUser,
    dto: CreateHandoverReportDto,
  ): Promise<DefectReportSummary> {
    if (dto.items.length > HANDOVER_REPORT_ITEMS_HARD_CAP) {
      throw new BadRequestException(
        `This submission has ${dto.items.length} defects; the maximum is ${HANDOVER_REPORT_ITEMS_HARD_CAP}. Please split into smaller batches.`,
      );
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    // Resolve taxonomy names so each line item has a readable title that the
    // existing Defect lifecycle/board/export can use unchanged.
    const elementIds = [...new Set(dto.items.map((i) => i.elementId).filter(Boolean) as string[])];
    const issueIds = [...new Set(dto.items.map((i) => i.issueId).filter(Boolean) as string[])];
    const spaceTypeIds = [
      ...new Set(dto.items.map((i) => i.spaceTypeId).filter(Boolean) as string[]),
    ];

    const [elements, issues, spaceTypes] = await Promise.all([
      elementIds.length
        ? this.prisma.defectElement.findMany({ where: { id: { in: elementIds } } })
        : Promise.resolve([]),
      issueIds.length
        ? this.prisma.defectIssue.findMany({ where: { id: { in: issueIds } } })
        : Promise.resolve([]),
      spaceTypeIds.length
        ? this.prisma.defectSpaceType.findMany({ where: { id: { in: spaceTypeIds } } })
        : Promise.resolve([]),
    ]);
    const elementName = new Map(elements.map((e) => [e.id, e.name]));
    const issueName = new Map(issues.map((i) => [i.id, i.name]));
    const spaceTypeName = new Map(spaceTypes.map((s) => [s.id, s.name]));

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.defectReport.create({
        data: {
          condoId: unit.condoId,
          unitId: unit.id,
          raisedByUserId: user.id,
          kind: DefectReportKind.HANDOVER,
          title: dto.title?.trim() || 'Multiple defects',
        },
      });

      const defectRows = dto.items.map((item, index) => {
        const elName = item.elementId ? elementName.get(item.elementId) : item.elementName;
        const isName = item.issueId ? issueName.get(item.issueId) : item.issueName;
        const spName = item.spaceTypeId ? spaceTypeName.get(item.spaceTypeId) : undefined;
        const title = handoverDefectTitle({
          spaceLabel: item.spaceLabel,
          elementName: elName ?? null,
          issueName: isName ?? null,
        });
        const description =
          item.note?.trim() ||
          [elName, isName].filter(Boolean).join(' — ') ||
          'Reported as part of a multi-defect submission.';

        return {
          condoId: unit.condoId,
          unitId: unit.id,
          raisedByUserId: user.id,
          reportId: created.id,
          category: spName ?? 'Handover',
          severity: 'MEDIUM' as const,
          title,
          description,
          location: item.spaceLabel,
          spaceLabel: item.spaceLabel,
          spaceTypeId: item.spaceTypeId ?? null,
          elementId: item.elementId ?? null,
          issueId: item.issueId ?? null,
          status: 'NEW' as const,
          metadata: { handoverIndex: index },
        };
      });

      // Chunked inserts — avoids oversized single statements and scales past 500+ items.
      const defectIdByIndex = new Map<number, string>();
      for (let offset = 0; offset < defectRows.length; offset += HANDOVER_REPORT_INSERT_CHUNK) {
        const chunk = defectRows.slice(offset, offset + HANDOVER_REPORT_INSERT_CHUNK);
        const created = await tx.defect.createManyAndReturn({ data: chunk });
        for (const d of created) {
          const idx = (d.metadata as { handoverIndex?: number })?.handoverIndex;
          if (typeof idx === 'number') defectIdByIndex.set(idx, d.id);
        }
      }

      // Commit pre-uploaded photos per line item.
      for (let i = 0; i < dto.items.length; i++) {
        const attachmentIds = dto.items[i]?.attachmentIds;
        if (!attachmentIds?.length) continue;
        const defectId = defectIdByIndex.get(i);
        if (!defectId) continue;
        await tx.attachment.updateMany({
          where: {
            id: { in: attachmentIds },
            uploadedByUserId: user.id,
            ownerKind: AttachmentOwner.GENERIC,
          },
          data: {
            defectId,
            ownerKind: AttachmentOwner.DEFECT,
            status: AttachmentStatus.COMMITTED,
          },
        });
      }

      return created;
    }, handoverReportTxOptions(dto.items.length));

    // ONE summary notification for the whole report (not one per item).
    this.events.emit('defect.report.created', {
      reportId: report.id,
      condoId: report.condoId,
      itemCount: dto.items.length,
      actorUserId: user.id,
    });

    return this.getSummary(user, report.id, dto.items.length);
  }

  /** FIFO list of handover reports for a condo (management board). */
  async listForCondo(user: AuthenticatedUser, condoId: string): Promise<DefectReportSummary[]> {
    if (!this.isManagement(user, condoId)) {
      throw new ForbiddenException('Only management can list condo inspections');
    }
    const reports = await this.prisma.defectReport.findMany({
      where: { condoId },
      orderBy: { createdAt: 'asc' },
      include: {
        raisedBy: { select: { id: true, name: true } },
        unit: {
          select: { id: true, identifier: true, floor: true, block: { select: { name: true } } },
        },
        _count: { select: { defects: true } },
      },
      take: 500,
    });
    if (reports.length === 0) return [];

    const grouped = await this.prisma.defect.groupBy({
      by: ['reportId', 'status'],
      where: { reportId: { in: reports.map((r) => r.id) } },
      _count: { _all: true },
    });
    const statusByReport = new Map<string, Partial<Record<DefectStatus, number>>>();
    for (const g of grouped) {
      if (!g.reportId) continue;
      const m = statusByReport.get(g.reportId) ?? {};
      m[g.status] = g._count._all;
      statusByReport.set(g.reportId, m);
    }

    return reports.map((r) => this.toSummary(r, statusByReport.get(r.id) ?? {}));
  }

  /** Unit package list for residents/owners: one parent row per multi-defect submission. */
  async listForUnit(user: AuthenticatedUser, unitId: string): Promise<DefectReportSummary[]> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const allowed =
      this.isManagement(user, unit.condoId) || user.roles.some((r) => r.unitId === unitId);
    if (!allowed) throw new ForbiddenException();

    const reports = await this.prisma.defectReport.findMany({
      where: { unitId },
      orderBy: { createdAt: 'asc' },
      include: {
        raisedBy: { select: { id: true, name: true } },
        unit: {
          select: { id: true, identifier: true, floor: true, block: { select: { name: true } } },
        },
        _count: { select: { defects: true } },
      },
      take: 500,
    });
    if (reports.length === 0) return [];

    const grouped = await this.prisma.defect.groupBy({
      by: ['reportId', 'status'],
      where: { reportId: { in: reports.map((r) => r.id) } },
      _count: { _all: true },
    });
    const statusByReport = new Map<string, Partial<Record<DefectStatus, number>>>();
    for (const g of grouped) {
      if (!g.reportId) continue;
      const m = statusByReport.get(g.reportId) ?? {};
      m[g.status] = g._count._all;
      statusByReport.set(g.reportId, m);
    }

    return reports.map((r) => this.toSummary(r, statusByReport.get(r.id) ?? {}));
  }

  /** Lightweight read after create — avoids re-fetching hundreds of line items. */
  private async getSummary(
    user: AuthenticatedUser,
    id: string,
    itemCount: number,
  ): Promise<DefectReportSummary> {
    const report = await this.prisma.defectReport.findUnique({
      where: { id },
      include: {
        raisedBy: { select: { id: true, name: true } },
        unit: {
          select: { id: true, identifier: true, floor: true, block: { select: { name: true } } },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const allowed =
      this.isManagement(user, report.condoId) ||
      report.raisedByUserId === user.id ||
      (report.unitId ? user.roles.some((r) => r.unitId === report.unitId) : false);
    if (!allowed) throw new ForbiddenException();

    return this.toSummary({ ...report, _count: { defects: itemCount } }, { NEW: itemCount });
  }

  async getOne(user: AuthenticatedUser, id: string): Promise<DefectReportDetail> {
    const report = await this.prisma.defectReport.findUnique({
      where: { id },
      include: {
        raisedBy: { select: { id: true, name: true } },
        unit: {
          select: { id: true, identifier: true, floor: true, block: { select: { name: true } } },
        },
        defects: {
          orderBy: [{ spaceLabel: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignedTo: { select: { id: true, name: true } },
            attachments: true,
            spaceType: { select: { name: true } },
            element: { select: { name: true } },
            issue: { select: { name: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const allowed =
      this.isManagement(user, report.condoId) ||
      report.raisedByUserId === user.id ||
      (report.unitId ? user.roles.some((r) => r.unitId === report.unitId) : false);
    if (!allowed) throw new ForbiddenException();

    const statusCounts: Partial<Record<DefectStatus, number>> = {};
    for (const d of report.defects) {
      statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
    }

    return {
      ...this.toSummary({ ...report, _count: { defects: report.defects.length } }, statusCounts),
      items: report.defects.map((d) => ({
        id: d.id,
        reportId: d.reportId,
        title: d.title,
        description: d.description,
        status: d.status,
        severity: d.severity,
        category: d.category,
        spaceLabel: d.spaceLabel,
        spaceTypeId: d.spaceTypeId,
        spaceTypeName: d.spaceType?.name ?? null,
        elementId: d.elementId,
        elementName: d.element?.name ?? null,
        issueId: d.issueId,
        issueName: d.issue?.name ?? null,
        assignedTo: d.assignedTo ? { id: d.assignedTo.id, name: d.assignedTo.name } : null,
        attachments: d.attachments.map((a) => ({
          id: a.id,
          key: a.key,
          thumbnailKey: a.thumbnailKey,
          mimeType: a.mimeType,
          width: a.width,
          height: a.height,
          size: a.size,
        })),
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Bulk triage of report line items (assign and/or transition status). Applies
   * only valid status transitions and writes a DefectUpdate per change. No
   * per-item push notifications are emitted (management batch action).
   */
  async bulkUpdateItems(id: string, user: AuthenticatedUser, dto: BulkUpdateReportItemsDto) {
    const report = await this.prisma.defectReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (!this.isManagement(user, report.condoId)) {
      throw new ForbiddenException('Only management can triage report items');
    }
    if (dto.defectIds.length > HANDOVER_REPORT_ITEMS_HARD_CAP) {
      throw new BadRequestException(
        `Cannot update ${dto.defectIds.length} items at once; the maximum is ${HANDOVER_REPORT_ITEMS_HARD_CAP}.`,
      );
    }

    const defects = await this.prisma.defect.findMany({
      where: { id: { in: dto.defectIds }, reportId: id },
    });

    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const d of defects) {
        const willTransition =
          dto.status !== undefined &&
          dto.status !== d.status &&
          canTransitionDefect(d.status, dto.status);
        const willAssign =
          dto.assignedToUserId !== undefined && dto.assignedToUserId !== d.assignedToUserId;
        if (!willTransition && !willAssign) continue;

        const nextStatus = willTransition ? dto.status! : d.status;
        await tx.defect.update({
          where: { id: d.id },
          data: {
            ...(willTransition ? { status: nextStatus } : {}),
            ...(dto.assignedToUserId !== undefined
              ? { assignedToUserId: dto.assignedToUserId }
              : {}),
            ...(willTransition && nextStatus === 'ACK' && !d.acknowledgedAt
              ? { acknowledgedAt: new Date() }
              : {}),
            ...(willTransition && nextStatus === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
            ...(willTransition && nextStatus === 'CLOSED' ? { closedAt: new Date() } : {}),
          },
        });
        await tx.defectUpdate.create({
          data: {
            defectId: d.id,
            authorUserId: user.id,
            message:
              dto.message ??
              (willTransition ? `Status changed to ${nextStatus} (bulk)` : 'Assigned (bulk)'),
            statusFrom: willTransition ? d.status : null,
            statusTo: willTransition ? nextStatus : null,
            isInternal: true,
          },
        });
        updated++;
      }
    }, handoverReportTxOptions(dto.defectIds.length));

    if (updated > 0 && dto.status === 'RESOLVED') {
      this.events.emit('defect.report.items.resolved', {
        reportId: id,
        condoId: report.condoId,
        updatedCount: updated,
        actorUserId: user.id,
      });
    }

    return { updated };
  }

  async exportPdf(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.getOne(user, id);
    if (!this.isManagement(user, report.condoId)) {
      throw new ForbiddenException('Only management can export reports');
    }

    const unitLabel = report.unit
      ? `${report.unit.block ? `${report.unit.block.name} ` : ''}${report.unit.identifier}`
      : 'Unassigned unit';

    const buffer = buildHandoverReportPdf({
      title: `Handover defect schedule — ${unitLabel}`,
      meta: [
        `Report: ${defectReference(report.id)}`,
        `Submitted by: ${report.raisedBy?.name ?? 'Resident'}`,
        `Generated: ${new Date().toISOString()}`,
        `Total items: ${report.itemCount}`,
      ],
      groups: this.groupItemsBySpace(report),
    });

    const date = new Date().toISOString().slice(0, 10);
    const safeUnit = unitLabel.replace(/[^\w-]/g, '-').slice(0, 30);
    return { buffer, filename: `handover-${safeUnit}-${date}.pdf` };
  }

  private groupItemsBySpace(report: DefectReportDetail) {
    const map = new Map<string, DefectReportDetail['items']>();
    for (const item of report.items) {
      const key = item.spaceLabel ?? 'Other';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()].map(([space, items]) => ({
      space,
      rows: items.map((i) => ({
        reference: defectReference(i.id),
        element: i.elementName ?? '-',
        issue: i.issueName ?? '-',
        status: i.status,
        assignee: i.assignedTo?.name ?? 'Unassigned',
        note: i.description,
      })),
    }));
  }

  private toSummary(
    report: {
      id: string;
      condoId: string;
      unitId: string | null;
      kind: DefectReportSummary['kind'];
      title: string;
      createdAt: Date;
      raisedBy?: { id: string; name: string } | null;
      unit?: {
        id: string;
        identifier: string;
        floor?: number | null;
        block: { name: string } | null;
      } | null;
      _count?: { defects: number };
    },
    statusCounts: Partial<Record<DefectStatus, number>>,
  ): DefectReportSummary {
    return {
      id: report.id,
      condoId: report.condoId,
      unitId: report.unitId,
      kind: report.kind,
      title: report.title,
      createdAt: report.createdAt.toISOString(),
      raisedBy: report.raisedBy ? { id: report.raisedBy.id, name: report.raisedBy.name } : null,
      unit: report.unit
        ? {
            id: report.unit.id,
            identifier: report.unit.identifier,
            floor: report.unit.floor ?? null,
            block: report.unit.block ? { name: report.unit.block.name } : null,
          }
        : null,
      itemCount: report._count?.defects ?? 0,
      statusCounts,
    };
  }
}
