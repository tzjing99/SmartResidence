import { GlPostingService } from '@/accounting/gl-posting.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AttachmentOwner,
  AttachmentStatus,
  AuditAction,
  type Prisma,
  type VendorBill,
  VendorBillStatus,
} from '@prisma/client';
import type {
  CreateVendorBillDto,
  ListVendorBillsDto,
  UpdateVendorBillDto,
} from './dto/vendor-bill.dto';
import { assertManagement, assertVendorBillFund, isManagementAdmin } from './procurement-access';
import { VendorService } from './vendor.service';

const billInclude = {
  vendor: { select: { id: true, name: true, contact: true, taxId: true } },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.VendorBillInclude;

function parseDateOnly(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Injectable()
export class VendorBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendors: VendorService,
    @Optional() private readonly glPosting?: GlPostingService,
  ) {}

  async listForCondo(user: AuthenticatedUser, condoId: string, query: ListVendorBillsDto) {
    assertManagement(user, condoId);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where: Prisma.VendorBillWhereInput = {
      condoId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.fund ? { fund: query.fund } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendorBill.findMany({
        where,
        include: billInclude,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.vendorBill.count({ where }),
    ]);

    return { items: items.map(serializeBill), total, limit, offset };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const bill = await this.requireBill(id);
    assertManagement(user, bill.condoId);
    return serializeBill(bill);
  }

  async create(user: AuthenticatedUser, dto: CreateVendorBillDto) {
    assertManagement(user, dto.condoId);
    assertVendorBillFund(dto.fund);
    const vendor = await this.vendors.requireVendor(dto.vendorId);
    if (vendor.condoId !== dto.condoId) {
      throw new BadRequestException('Vendor belongs to a different condo');
    }
    if (dto.attachmentId) {
      await this.assertAttachment(user.id, dto.attachmentId);
    }

    const bill = await this.prisma.vendorBill.create({
      data: {
        condoId: dto.condoId,
        vendorId: dto.vendorId,
        billNumber: dto.billNumber.trim(),
        billDate: parseDateOnly(dto.billDate, 'billDate'),
        dueDate: parseDateOnly(dto.dueDate, 'dueDate'),
        amount: dto.amount,
        fund: dto.fund,
        description: dto.description?.trim() || null,
        attachmentId: dto.attachmentId ?? null,
        status: VendorBillStatus.DRAFT,
      },
      include: billInclude,
    });

    if (dto.attachmentId) {
      await this.commitAttachment(dto.attachmentId);
    }

    await this.audit(user, bill.condoId, AuditAction.CREATE, bill.id);
    return serializeBill(bill);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateVendorBillDto) {
    const existing = await this.requireBill(id);
    assertManagement(user, existing.condoId);
    if (existing.status !== VendorBillStatus.DRAFT) {
      throw new BadRequestException('Only draft bills can be edited');
    }
    if (dto.fund) assertVendorBillFund(dto.fund);
    if (dto.vendorId) {
      const vendor = await this.vendors.requireVendor(dto.vendorId);
      if (vendor.condoId !== existing.condoId) {
        throw new BadRequestException('Vendor belongs to a different condo');
      }
    }
    if (dto.attachmentId) {
      await this.assertAttachment(user.id, dto.attachmentId);
    }

    const bill = await this.prisma.vendorBill.update({
      where: { id },
      data: {
        ...(dto.vendorId !== undefined ? { vendorId: dto.vendorId } : {}),
        ...(dto.billNumber !== undefined ? { billNumber: dto.billNumber.trim() } : {}),
        ...(dto.billDate !== undefined
          ? { billDate: parseDateOnly(dto.billDate, 'billDate') }
          : {}),
        ...(dto.dueDate !== undefined ? { dueDate: parseDateOnly(dto.dueDate, 'dueDate') } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.fund !== undefined ? { fund: dto.fund } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.attachmentId !== undefined ? { attachmentId: dto.attachmentId } : {}),
      },
      include: billInclude,
    });

    if (dto.attachmentId) {
      await this.commitAttachment(dto.attachmentId);
    }

    await this.audit(user, bill.condoId, AuditAction.UPDATE, bill.id);
    return serializeBill(bill);
  }

  async approve(user: AuthenticatedUser, id: string) {
    const existing = await this.requireBill(id);
    assertManagement(user, existing.condoId);
    if (!isManagementAdmin(user, existing.condoId)) {
      throw new ForbiddenException('Only management admin can approve vendor bills');
    }
    if (existing.status !== VendorBillStatus.DRAFT) {
      throw new BadRequestException('Only draft bills can be approved');
    }

    const bill = await this.prisma.vendorBill.update({
      where: { id },
      data: {
        status: VendorBillStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
      include: billInclude,
    });

    await this.glPosting?.postVendorBillApproved(this.prisma, {
      vendorBillId: bill.id,
      condoId: bill.condoId,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      amount: Number(bill.amount),
      fund: bill.fund,
      description: bill.description,
      actorUserId: user.id,
    });

    await this.audit(user, bill.condoId, AuditAction.UPDATE, bill.id, { approved: true });
    return serializeBill(bill);
  }

  async markPaid(user: AuthenticatedUser, id: string) {
    const existing = await this.requireBill(id);
    assertManagement(user, existing.condoId);
    if (!isManagementAdmin(user, existing.condoId)) {
      throw new ForbiddenException('Only management admin can mark vendor bills paid');
    }
    if (existing.status !== VendorBillStatus.APPROVED) {
      throw new BadRequestException('Only approved bills can be marked paid');
    }

    const paidAt = new Date();
    const journalEntryId = await this.glPosting?.postVendorBillPaid(this.prisma, {
      vendorBillId: existing.id,
      condoId: existing.condoId,
      billNumber: existing.billNumber,
      paidAt,
      amount: Number(existing.amount),
      fund: existing.fund,
      actorUserId: user.id,
    });

    const bill = await this.prisma.vendorBill.update({
      where: { id },
      data: {
        status: VendorBillStatus.PAID,
        paidAt,
        ...(journalEntryId ? { glJournalEntryId: journalEntryId } : {}),
      },
      include: billInclude,
    });

    await this.audit(user, bill.condoId, AuditAction.UPDATE, bill.id, { paid: true });
    return serializeBill(bill);
  }

  async voidBill(user: AuthenticatedUser, id: string) {
    const existing = await this.requireBill(id);
    assertManagement(user, existing.condoId);
    if (!isManagementAdmin(user, existing.condoId)) {
      throw new ForbiddenException('Only management admin can void vendor bills');
    }
    if (existing.status === VendorBillStatus.PAID) {
      throw new BadRequestException('Paid bills cannot be voided');
    }
    if (existing.status === VendorBillStatus.VOID) {
      throw new BadRequestException('Bill is already void');
    }

    const bill = await this.prisma.vendorBill.update({
      where: { id },
      data: { status: VendorBillStatus.VOID },
      include: billInclude,
    });

    await this.audit(user, bill.condoId, AuditAction.UPDATE, bill.id, { voided: true });
    return serializeBill(bill);
  }

  private async requireBill(id: string) {
    const bill = await this.prisma.vendorBill.findUnique({
      where: { id },
      include: billInclude,
    });
    if (!bill) throw new NotFoundException('Vendor bill not found');
    return bill;
  }

  private async assertAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        uploadedByUserId: true,
        ownerKind: true,
        vendorBill: { select: { id: true } },
      },
    });
    if (!attachment) throw new BadRequestException('Attachment not found');
    if (attachment.uploadedByUserId !== userId) {
      throw new BadRequestException('Attachment was not uploaded by you');
    }
    if (attachment.ownerKind !== AttachmentOwner.GENERIC) {
      throw new BadRequestException('Attachment is already in use');
    }
    if (attachment.vendorBill?.id) {
      throw new BadRequestException('Attachment is already linked to a bill');
    }
  }

  private async commitAttachment(attachmentId: string) {
    await this.prisma.attachment.updateMany({
      where: { id: attachmentId, ownerKind: AttachmentOwner.GENERIC },
      data: { status: AttachmentStatus.COMMITTED },
    });
  }

  private async audit(
    user: AuthenticatedUser,
    condoId: string,
    action: AuditAction,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action,
        resourceType: 'VendorBill',
        resourceId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

function serializeBill(
  bill: VendorBill & {
    vendor?: { id: string; name: string; contact: string | null; taxId: string | null };
    approvedBy?: { id: string; name: string } | null;
  },
) {
  return {
    ...bill,
    amount: Number(bill.amount),
    billDate: bill.billDate.toISOString().slice(0, 10),
    dueDate: bill.dueDate.toISOString().slice(0, 10),
  };
}

export { parseDateOnly };
