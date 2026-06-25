import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { HandoverTemplate } from '@smartresidence/shared-types';
import type {
  CreateDefectElementDto,
  CreateDefectIssueDto,
  CreateDefectSpaceTypeDto,
  CreateUnitTypeDto,
  CreateUnitTypeSpaceDto,
  UpdateDefectElementDto,
  UpdateDefectIssueDto,
  UpdateDefectSpaceTypeDto,
  UpdateUnitTypeDto,
  UpdateUnitTypeSpaceDto,
} from './dto/handover-config.dto';

@Injectable()
export class HandoverConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // -- Unit types -----------------------------------------------------

  listUnitTypes(condoId: string) {
    return this.prisma.unitType.findMany({
      where: { condoId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        spaces: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: { spaceType: true },
        },
      },
    });
  }

  createUnitType(dto: CreateUnitTypeDto) {
    return this.prisma.unitType.create({
      data: {
        condoId: dto.condoId,
        name: dto.name,
        description: dto.description ?? null,
        position: dto.position ?? 0,
      },
    });
  }

  async updateUnitType(id: string, dto: UpdateUnitTypeDto) {
    await this.ensureUnitType(id);
    return this.prisma.unitType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteUnitType(id: string) {
    await this.ensureUnitType(id);
    await this.prisma.unitType.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureUnitType(id: string) {
    const ut = await this.prisma.unitType.findUnique({ where: { id } });
    if (!ut) throw new NotFoundException('Unit type not found');
    return ut;
  }

  // -- Unit type spaces (room template rows) --------------------------

  async addSpace(unitTypeId: string, dto: CreateUnitTypeSpaceDto) {
    await this.ensureUnitType(unitTypeId);
    return this.prisma.unitTypeSpace.create({
      data: {
        unitTypeId,
        name: dto.name,
        spaceTypeId: dto.spaceTypeId ?? null,
        position: dto.position ?? 0,
      },
      include: { spaceType: true },
    });
  }

  async updateSpace(id: string, dto: UpdateUnitTypeSpaceDto) {
    const existing = await this.prisma.unitTypeSpace.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Room not found');
    return this.prisma.unitTypeSpace.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.spaceTypeId !== undefined ? { spaceTypeId: dto.spaceTypeId } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
      include: { spaceType: true },
    });
  }

  async deleteSpace(id: string) {
    const existing = await this.prisma.unitTypeSpace.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Room not found');
    await this.prisma.unitTypeSpace.delete({ where: { id } });
    return { ok: true };
  }

  // -- Defect taxonomy (space type -> element -> issue) ---------------

  getTaxonomy(condoId: string) {
    return this.prisma.defectSpaceType.findMany({
      where: { condoId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        elements: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: {
            issues: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
          },
        },
      },
    });
  }

  createSpaceType(dto: CreateDefectSpaceTypeDto) {
    return this.prisma.defectSpaceType.create({
      data: { condoId: dto.condoId, name: dto.name, position: dto.position ?? 0 },
    });
  }

  async updateSpaceType(id: string, dto: UpdateDefectSpaceTypeDto) {
    const existing = await this.prisma.defectSpaceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Space type not found');
    return this.prisma.defectSpaceType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteSpaceType(id: string) {
    const existing = await this.prisma.defectSpaceType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Space type not found');
    await this.prisma.defectSpaceType.delete({ where: { id } });
    return { ok: true };
  }

  async createElement(dto: CreateDefectElementDto) {
    const spaceType = await this.prisma.defectSpaceType.findUnique({
      where: { id: dto.spaceTypeId },
    });
    if (!spaceType) throw new NotFoundException('Space type not found');
    return this.prisma.defectElement.create({
      data: {
        condoId: spaceType.condoId,
        spaceTypeId: spaceType.id,
        name: dto.name,
        position: dto.position ?? 0,
      },
    });
  }

  async updateElement(id: string, dto: UpdateDefectElementDto) {
    const existing = await this.prisma.defectElement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Element not found');
    return this.prisma.defectElement.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteElement(id: string) {
    const existing = await this.prisma.defectElement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Element not found');
    await this.prisma.defectElement.delete({ where: { id } });
    return { ok: true };
  }

  async createIssue(dto: CreateDefectIssueDto) {
    const element = await this.prisma.defectElement.findUnique({ where: { id: dto.elementId } });
    if (!element) throw new NotFoundException('Element not found');
    return this.prisma.defectIssue.create({
      data: {
        condoId: element.condoId,
        elementId: element.id,
        name: dto.name,
        position: dto.position ?? 0,
      },
    });
  }

  async updateIssue(id: string, dto: UpdateDefectIssueDto) {
    const existing = await this.prisma.defectIssue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Issue not found');
    return this.prisma.defectIssue.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteIssue(id: string) {
    const existing = await this.prisma.defectIssue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Issue not found');
    await this.prisma.defectIssue.delete({ where: { id } });
    return { ok: true };
  }

  // -- Unit type assignment + handover template -----------------------

  async setUnitType(condoId: string, unitId: string, unitTypeId: string | null) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.condoId !== condoId) throw new NotFoundException('Unit not found');
    if (unitTypeId) {
      const ut = await this.prisma.unitType.findUnique({ where: { id: unitTypeId } });
      if (!ut || ut.condoId !== condoId) {
        throw new NotFoundException('Unit type not found in this condo');
      }
    }
    return this.prisma.unit.update({
      where: { id: unitId },
      data: { unitTypeId },
      include: { unitType: true },
    });
  }

  async handoverTemplate(unitId: string): Promise<HandoverTemplate> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        unitType: {
          include: {
            spaces: {
              orderBy: [{ position: 'asc' }, { name: 'asc' }],
              include: { spaceType: true },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const taxonomy = await this.getTaxonomy(unit.condoId);

    return {
      unitId: unit.id,
      unitTypeId: unit.unitTypeId,
      unitTypeName: unit.unitType?.name ?? null,
      spaces: (unit.unitType?.spaces ?? []).map((s) => ({
        spaceLabel: s.name,
        spaceTypeId: s.spaceTypeId,
        spaceTypeName: s.spaceType?.name ?? null,
      })),
      taxonomy: taxonomy.map((st) => ({
        id: st.id,
        condoId: st.condoId,
        name: st.name,
        position: st.position,
        elements: st.elements.map((el) => ({
          id: el.id,
          condoId: el.condoId,
          spaceTypeId: el.spaceTypeId,
          name: el.name,
          position: el.position,
          issues: el.issues.map((iss) => ({
            id: iss.id,
            condoId: iss.condoId,
            elementId: iss.elementId,
            name: iss.name,
            position: iss.position,
          })),
        })),
      })),
    };
  }
}
