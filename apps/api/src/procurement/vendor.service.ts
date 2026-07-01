import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma, type Vendor } from '@prisma/client';
import type { CreateVendorDto, ListVendorsDto, UpdateVendorDto } from './dto/vendor.dto';
import { assertManagement } from './procurement-access';

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCondo(user: AuthenticatedUser, condoId: string, query: ListVendorsDto) {
    assertManagement(user, condoId);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where: Prisma.VendorWhereInput = {
      condoId,
      ...(query.activeOnly ? { active: true } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getOne(user: AuthenticatedUser, id: string): Promise<Vendor> {
    const vendor = await this.requireVendor(id);
    assertManagement(user, vendor.condoId);
    return vendor;
  }

  async create(user: AuthenticatedUser, dto: CreateVendorDto): Promise<Vendor> {
    assertManagement(user, dto.condoId);
    const vendor = await this.prisma.vendor.create({
      data: {
        condoId: dto.condoId,
        name: dto.name.trim(),
        contact: dto.contact?.trim() || null,
        taxId: dto.taxId?.trim() || null,
        active: dto.active ?? true,
      },
    });
    await this.audit(user, vendor.condoId, AuditAction.CREATE, vendor.id);
    return vendor;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateVendorDto): Promise<Vendor> {
    const existing = await this.requireVendor(id);
    assertManagement(user, existing.condoId);

    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact.trim() || null } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId.trim() || null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit(user, vendor.condoId, AuditAction.UPDATE, vendor.id);
    return vendor;
  }

  async requireVendor(id: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async audit(
    user: AuthenticatedUser,
    condoId: string,
    action: AuditAction,
    resourceId: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        condoId,
        actorUserId: user.id,
        actorRole: user.activeRole,
        action,
        resourceType: 'Vendor',
        resourceId,
      },
    });
  }
}
