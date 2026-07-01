import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LedgerFund } from '@prisma/client';
import {
  COMMON_FEE_SCHEDULE_PRESETS,
  FEE_SCHEDULE_CATEGORY_LABELS,
  type FeeScheduleExtraLineFund,
  computeFeeAmount,
  resolveFeeScheduleExtraLineFund,
} from '@smartresidence/shared-types';
import type {
  AddFeeSchedulePresetsDto,
  UpsertFeeRateDto,
  UpsertFeeScheduleExtraLineDto,
} from './dto/fee-schedule.dto';

export interface ComputedFeeLine {
  code: string;
  description: string;
  formula?: string;
  unitPrice: number;
  quantity: number;
  fund: LedgerFund;
}

type JsonMap = Record<string, unknown>;

const toJsonMap = (value: unknown): JsonMap =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : {};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class FeeScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /** List every unit type in the condo with its (optional) fee rate. */
  async listForCondo(condoId: string) {
    const unitTypes = await this.prisma.unitType.findMany({
      where: { condoId },
      include: { feeRate: true, _count: { select: { units: true } } },
      orderBy: { position: 'asc' },
    });
    return unitTypes.map((ut) => ({
      unitTypeId: ut.id,
      unitTypeName: ut.name,
      unitCount: ut._count.units,
      feeRate: ut.feeRate
        ? {
            id: ut.feeRate.id,
            unitTypeId: ut.feeRate.unitTypeId,
            maintenanceRateType: ut.feeRate.maintenanceRateType,
            maintenanceAmount: Number(ut.feeRate.maintenanceAmount),
            sinkingFundRateType: ut.feeRate.sinkingFundRateType,
            sinkingFundAmount: Number(ut.feeRate.sinkingFundAmount),
            currencyCode: ut.feeRate.currencyCode,
          }
        : null,
    }));
  }

  async upsert(condoId: string, dto: UpsertFeeRateDto) {
    const unitType = await this.prisma.unitType.findFirst({
      where: { id: dto.unitTypeId, condoId },
    });
    if (!unitType) throw new NotFoundException('Unit type not found in this condo');

    return this.prisma.unitTypeFeeRate.upsert({
      where: { unitTypeId: dto.unitTypeId },
      update: {
        maintenanceRateType: dto.maintenanceRateType,
        maintenanceAmount: dto.maintenanceAmount,
        sinkingFundRateType: dto.sinkingFundRateType,
        sinkingFundAmount: dto.sinkingFundAmount,
      },
      create: {
        condoId,
        unitTypeId: dto.unitTypeId,
        maintenanceRateType: dto.maintenanceRateType,
        maintenanceAmount: dto.maintenanceAmount,
        sinkingFundRateType: dto.sinkingFundRateType,
        sinkingFundAmount: dto.sinkingFundAmount,
      },
    });
  }

  async remove(condoId: string, unitTypeId: string) {
    const existing = await this.prisma.unitTypeFeeRate.findFirst({
      where: { unitTypeId, condoId },
    });
    if (!existing) throw new NotFoundException('Fee rate not found');
    await this.prisma.unitTypeFeeRate.delete({ where: { unitTypeId } });
    return { deleted: true };
  }

  async listExtraLines(condoId: string) {
    const rows = await this.prisma.feeScheduleExtraLine.findMany({
      where: { condoId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toExtraLineView(row));
  }

  async upsertExtraLine(condoId: string, dto: UpsertFeeScheduleExtraLineDto) {
    await this.assertCondoExists(condoId);
    if (dto.id) {
      const existing = await this.prisma.feeScheduleExtraLine.findFirst({
        where: { id: dto.id, condoId },
      });
      if (!existing) throw new NotFoundException('Fee schedule line not found');
    }

    const data = this.buildExtraLineData(dto);
    const row = dto.id
      ? await this.prisma.feeScheduleExtraLine.update({ where: { id: dto.id }, data })
      : await this.prisma.feeScheduleExtraLine.create({
          data: {
            condoId,
            ...data,
          },
        });
    return this.toExtraLineView(row);
  }

  async removeExtraLine(condoId: string, id: string) {
    const existing = await this.prisma.feeScheduleExtraLine.findFirst({ where: { id, condoId } });
    if (!existing) throw new NotFoundException('Fee schedule line not found');
    await this.prisma.feeScheduleExtraLine.delete({ where: { id } });
    return { deleted: true };
  }

  async addPresetExtraLines(condoId: string, dto: AddFeeSchedulePresetsDto) {
    await this.assertCondoExists(condoId);
    const recurring = dto.recurring === true;
    const range = recurring ? { start: null, end: null } : this.monthRange(dto.month);
    const requested = dto.presetCodes?.length
      ? COMMON_FEE_SCHEDULE_PRESETS.filter(
          (p) => dto.presetCodes?.includes(p.category) || dto.presetCodes?.includes(p.code),
        )
      : COMMON_FEE_SCHEDULE_PRESETS;

    if (requested.length === 0) throw new BadRequestException('No recognised fee presets selected');

    let created = 0;
    let skipped = 0;
    const items = [];
    for (const preset of requested) {
      const duplicate = await this.prisma.feeScheduleExtraLine.findFirst({
        where: {
          condoId,
          code: preset.code,
          recurring,
          effectiveFrom: range.start,
        },
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }
      const row = await this.prisma.feeScheduleExtraLine.create({
        data: {
          condoId,
          code: preset.code,
          description: preset.description,
          category: preset.category,
          fund: preset.fund,
          formula: preset.formula,
          rateType: 'FLAT',
          amount: 0,
          recurring,
          effectiveFrom: range.start,
          effectiveTo: range.end,
          enabled: true,
          sortOrder: 100 + created,
          metadata: {
            preset: true,
            presetLabel: FEE_SCHEDULE_CATEGORY_LABELS[preset.category],
          },
        },
      });
      created += 1;
      items.push(this.toExtraLineView(row));
    }
    return { created, skipped, items };
  }

  async listActiveExtraLinesForPeriod(condoId: string, periodStart: Date, periodEnd: Date) {
    return this.prisma.feeScheduleExtraLine.findMany({
      where: {
        condoId,
        enabled: true,
        OR: [
          {
            recurring: true,
            AND: [
              { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: periodEnd } }] },
              { OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }] },
            ],
          },
          {
            recurring: false,
            effectiveFrom: { lte: periodEnd },
            effectiveTo: { gte: periodStart },
          },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Derive the maintenance + sinking-fund invoice lines for a unit from its
   * unit type's fee rate. Returns an empty array if the unit has no type or no
   * configured rate (caller falls back to explicit lines).
   */
  computeLinesForUnit(unit: {
    sqft: unknown;
    unitTypeId?: string | null;
    unitType?: {
      id?: string;
      name?: string;
      feeRate?: {
        maintenanceRateType: 'PER_SQFT' | 'FLAT';
        maintenanceAmount: unknown;
        sinkingFundRateType: 'PER_SQFT' | 'FLAT';
        sinkingFundAmount: unknown;
      } | null;
    } | null;
  }): ComputedFeeLine[] {
    const rate = unit.unitType?.feeRate;
    if (!rate) return [];
    const sqft = unit.sqft == null ? 0 : Number(unit.sqft);
    const lines: ComputedFeeLine[] = [];

    const maint = computeFeeAmount(rate.maintenanceRateType, Number(rate.maintenanceAmount), sqft);
    if (maint > 0) {
      lines.push({
        code: 'MAINT',
        description: 'Monthly maintenance fee',
        formula:
          rate.maintenanceRateType === 'PER_SQFT'
            ? `${Number(rate.maintenanceAmount)}/sqft × ${sqft} sqft`
            : undefined,
        unitPrice: maint,
        quantity: 1,
        fund: 'MAINTENANCE',
      });
    }

    const sinking = computeFeeAmount(
      rate.sinkingFundRateType,
      Number(rate.sinkingFundAmount),
      sqft,
    );
    if (sinking > 0) {
      lines.push({
        code: 'SINKING',
        description: 'Sinking fund contribution',
        formula:
          rate.sinkingFundRateType === 'PER_SQFT'
            ? `${Number(rate.sinkingFundAmount)}/sqft × ${sqft} sqft`
            : undefined,
        unitPrice: sinking,
        quantity: 1,
        fund: 'SINKING_FUND',
      });
    }

    return lines;
  }

  computeExtraLinesForUnit(
    unit: {
      sqft: unknown;
      unitTypeId?: string | null;
      unitType?: { id?: string; name?: string } | null;
    },
    extraLines: Array<{
      code: string;
      description: string;
      formula?: string | null;
      fund: LedgerFund;
      rateType: 'FLAT' | 'PER_SQFT' | 'PER_UNIT_TYPE';
      amount: unknown;
      unitTypeAmounts: unknown;
    }>,
  ): ComputedFeeLine[] {
    const sqft = unit.sqft == null ? 0 : Number(unit.sqft);
    const unitTypeId = unit.unitTypeId ?? unit.unitType?.id ?? null;
    const lines: ComputedFeeLine[] = [];

    for (const extra of extraLines) {
      const amount = this.computeExtraAmount(extra, sqft, unitTypeId);
      if (amount <= 0) continue;
      lines.push({
        code: extra.code,
        description: extra.description,
        formula: this.extraFormula(extra, sqft, unit.unitType?.name),
        unitPrice: amount,
        quantity: 1,
        fund: extra.fund,
      });
    }

    return lines;
  }

  private async assertCondoExists(condoId: string) {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { id: true },
    });
    if (!condo) throw new NotFoundException('Condo not found');
  }

  private buildExtraLineData(dto: UpsertFeeScheduleExtraLineDto) {
    const recurring = dto.recurring === true;
    const effectiveFrom = dto.effectiveFrom ?? null;
    let effectiveTo = dto.effectiveTo ?? null;
    if (!recurring) {
      if (!effectiveFrom) {
        throw new BadRequestException('Select a billing month for one-off fee lines');
      }
      if (!effectiveTo) {
        const month = `${effectiveFrom.getUTCFullYear()}-${String(effectiveFrom.getUTCMonth() + 1).padStart(2, '0')}`;
        effectiveTo = this.monthRange(month).end;
      }
    }
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
      throw new BadRequestException('Fee line end date cannot be before start date');
    }

    const unitTypeAmounts = Object.fromEntries(
      Object.entries(dto.unitTypeAmounts ?? {})
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value) && value >= 0),
    );

    let fund: FeeScheduleExtraLineFund;
    try {
      fund = resolveFeeScheduleExtraLineFund({ fund: dto.fund, category: dto.category });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    return {
      code: dto.code.trim().toUpperCase(),
      description: dto.description.trim(),
      category: dto.category?.trim() || 'OTHER',
      fund,
      formula: dto.formula?.trim() || null,
      rateType: dto.rateType,
      amount: dto.amount ?? 0,
      unitTypeAmounts: unitTypeAmounts as Prisma.InputJsonValue,
      recurring,
      effectiveFrom,
      effectiveTo,
      enabled: dto.enabled ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
  }

  private monthRange(month?: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Select a billing month in YYYY-MM format');
    }
    const [year, monthNumber] = month.split('-').map(Number);
    if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
      throw new BadRequestException('Select a valid billing month');
    }
    return {
      start: new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)),
    };
  }

  private computeExtraAmount(
    extra: {
      rateType: 'FLAT' | 'PER_SQFT' | 'PER_UNIT_TYPE';
      amount: unknown;
      unitTypeAmounts: unknown;
    },
    sqft: number,
    unitTypeId: string | null,
  ) {
    if (extra.rateType === 'PER_UNIT_TYPE') {
      if (!unitTypeId) return 0;
      const amount = Number(toJsonMap(extra.unitTypeAmounts)[unitTypeId] ?? 0);
      return Number.isFinite(amount) ? roundMoney(amount) : 0;
    }
    return computeFeeAmount(extra.rateType, Number(extra.amount), sqft);
  }

  private extraFormula(
    extra: {
      formula?: string | null;
      rateType: 'FLAT' | 'PER_SQFT' | 'PER_UNIT_TYPE';
      amount: unknown;
    },
    sqft: number,
    unitTypeName?: string,
  ) {
    const formula = extra.formula?.trim();
    if (formula) return formula;
    if (extra.rateType === 'PER_SQFT') return `${Number(extra.amount)}/sqft × ${sqft} sqft`;
    if (extra.rateType === 'PER_UNIT_TYPE') {
      return unitTypeName ? `Configured rate for ${unitTypeName}` : 'Configured unit type rate';
    }
    return undefined;
  }

  private toExtraLineView(row: {
    amount: unknown;
    unitTypeAmounts: unknown;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    [key: string]: unknown;
  }) {
    const unitTypeAmounts = Object.fromEntries(
      Object.entries(toJsonMap(row.unitTypeAmounts))
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
    return {
      ...row,
      amount: Number(row.amount),
      unitTypeAmounts,
    };
  }
}
