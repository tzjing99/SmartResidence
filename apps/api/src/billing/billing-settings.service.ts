import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type BillingAutomationSettings,
  BillingAutomationSettingsSchema,
  type ReceiptTemplateConfig,
} from '@smartresidence/shared-types';
import type {
  UpdateBillingAutomationDto,
  UpdateReceiptTemplateDto,
} from './dto/billing-settings.dto';
import { mergeReceiptTemplate, parseReceiptTemplate } from './receipt-template';

@Injectable()
export class BillingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseSettings(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  async getReceiptTemplate(condoId: string): Promise<ReceiptTemplateConfig> {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return parseReceiptTemplate(condo.settings);
  }

  async updateReceiptTemplate(
    condoId: string,
    dto: UpdateReceiptTemplateDto,
  ): Promise<ReceiptTemplateConfig> {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const patch: Partial<ReceiptTemplateConfig> = {};
    for (const key of [
      'numberPrefix',
      'organizationName',
      'registrationNo',
      'addressLines',
      'footerNote',
      'signatoryName',
      'signatoryTitle',
      'logoUrl',
    ] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key];
    }
    const settings = mergeReceiptTemplate(condo.settings, patch);
    await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    return parseReceiptTemplate(settings);
  }

  async getBillingAutomation(condoId: string): Promise<BillingAutomationSettings> {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const settings = this.parseSettings(condo.settings);
    return BillingAutomationSettingsSchema.parse(settings.billingAutomation ?? {});
  }

  async updateBillingAutomation(
    condoId: string,
    dto: UpdateBillingAutomationDto,
  ): Promise<BillingAutomationSettings> {
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const settings = this.parseSettings(condo.settings);
    const current = BillingAutomationSettingsSchema.parse(settings.billingAutomation ?? {});
    const next = BillingAutomationSettingsSchema.parse({ ...current, ...dto });
    const merged = { ...settings, billingAutomation: next };
    await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: merged as Prisma.InputJsonValue },
    });
    return next;
  }
}
