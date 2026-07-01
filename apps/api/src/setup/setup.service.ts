import { PrismaService } from '@/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, RoleId } from '@prisma/client';
import {
  BillingAutomationSettingsSchema,
  DEFAULT_BILLING_AUTOMATION_SETTINGS,
  SETUP_STEP_ORDER,
  type SetupChecklistFacts,
  type SetupStatus,
  type SetupStepKey,
  type SetupStepStatus,
} from '@smartresidence/shared-types';
import { parseReceiptTemplate } from '@/billing/receipt-template';
import { mergeSetupState, parseSetupState } from './setup-settings';
import type { UpdateSetupStepDto } from './dto/setup.dto';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCondoScope(user: AuthenticatedUser, condoId: string): void {
    const allowed = user.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === condoId),
    );
    if (!allowed) {
      throw new ForbiddenException('You do not manage this building');
    }
  }

  private readBillingAutomationEnabled(settings: unknown): boolean {
    const rawSettings = asObject(settings);
    const rawAutomation =
      rawSettings.billingAutomation ??
      rawSettings.billingAutomationSettings ??
      rawSettings.automation;
    const parsed = BillingAutomationSettingsSchema.safeParse(rawAutomation ?? {});
    return parsed.success ? parsed.data.enabled : DEFAULT_BILLING_AUTOMATION_SETTINGS.enabled;
  }

  /**
   * Cheap, data-derived facts about how much of the essentials already exist.
   * Kept to lightweight counts so status polling stays fast.
   */
  private async deriveFacts(
    condo: { id: string; name: string; address: string; settings: unknown },
  ): Promise<SetupChecklistFacts> {
    const condoId = condo.id;
    const [
      blockCount,
      unitTypeCount,
      unitCount,
      feeRateCount,
      enabledGatewayCount,
      residentCount,
      slaPolicyCount,
      mcpCount,
    ] = await Promise.all([
      this.prisma.block.count({ where: { condoId } }),
      this.prisma.unitType.count({ where: { condoId } }),
      this.prisma.unit.count({ where: { condoId } }),
      this.prisma.unitTypeFeeRate.count({ where: { condoId } }),
      this.prisma.paymentGatewayConnection.count({ where: { condoId, enabled: true } }),
      this.prisma.roleAssignment.count({
        where: {
          condoId,
          revokedAt: null,
          roleId: { in: [RoleId.UNIT_OWNER, RoleId.TENANT] },
        },
      }),
      this.prisma.slaPolicy.count({ where: { condoId } }),
      this.prisma.mcpServerConnection.count({ where: { condoId } }),
    ]);

    const receipt = parseReceiptTemplate(condo.settings);
    const hasReceiptTemplate = receipt.organizationName.trim().length > 0;
    const hasProfile =
      condo.name.trim().length >= 2 && condo.address.trim().length >= 3;

    return {
      hasProfile,
      blockCount,
      unitTypeCount,
      unitCount,
      feeRateCount,
      hasReceiptTemplate,
      billingAutomationEnabled: this.readBillingAutomationEnabled(condo.settings),
      enabledGatewayCount,
      residentCount,
      slaPolicyCount,
      mcpCount,
    };
  }

  /**
   * Derive whether a step is satisfied from real data. Returns `null` for
   * steps that cannot be inferred (operations toggles, optional integrations)
   * which rely purely on the admin's explicit done/skip choice.
   */
  private deriveSatisfied(key: SetupStepKey, facts: SetupChecklistFacts): boolean | null {
    switch (key) {
      case 'condoProfile':
        return facts.hasProfile;
      case 'structure':
        return facts.blockCount >= 1 && facts.unitTypeCount >= 1 && facts.unitCount >= 1;
      case 'billing':
        return facts.feeRateCount >= 1 && facts.hasReceiptTemplate;
      case 'residents':
        return facts.residentCount >= 1;
      default:
        return null;
    }
  }

  private buildStatus(
    condoId: string,
    settings: unknown,
    facts: SetupChecklistFacts,
  ): SetupStatus {
    const stored = parseSetupState(settings);
    const steps: SetupStepStatus[] = SETUP_STEP_ORDER.map((key) => {
      const s = stored.steps[key];
      return {
        key,
        done: s?.done ?? false,
        skipped: s?.skipped ?? false,
        updatedAt: s?.updatedAt ?? null,
        satisfied: this.deriveSatisfied(key, facts),
      };
    });

    const ready = steps
      .filter((s) => s.key !== 'review')
      .every((s) => s.satisfied === true || s.done || s.skipped);

    return {
      condoId,
      completedAt: stored.completedAt,
      dismissedAt: stored.dismissedAt,
      steps,
      facts,
      ready,
    };
  }

  async getStatus(user: AuthenticatedUser, condoId: string): Promise<SetupStatus> {
    this.assertCondoScope(user, condoId);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    const facts = await this.deriveFacts(condo);
    return this.buildStatus(condoId, condo.settings, facts);
  }

  async updateStep(
    user: AuthenticatedUser,
    condoId: string,
    dto: UpdateSetupStepDto,
  ): Promise<SetupStatus> {
    this.assertCondoScope(user, condoId);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const merged = mergeSetupState(condo.settings, {
      step: { key: dto.step, done: dto.done, skipped: dto.skipped },
    });
    const updated = await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: merged as Prisma.InputJsonValue },
    });
    const facts = await this.deriveFacts(updated);
    return this.buildStatus(condoId, updated.settings, facts);
  }

  /** Idempotent: sets `completedAt` once; re-running returns the existing state. */
  async complete(user: AuthenticatedUser, condoId: string): Promise<SetupStatus> {
    this.assertCondoScope(user, condoId);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const stored = parseSetupState(condo.settings);
    if (stored.completedAt) {
      const facts = await this.deriveFacts(condo);
      return this.buildStatus(condoId, condo.settings, facts);
    }

    const merged = mergeSetupState(condo.settings, { completedAt: new Date().toISOString() });
    const updated = await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: merged as Prisma.InputJsonValue },
    });
    const facts = await this.deriveFacts(updated);
    return this.buildStatus(condoId, updated.settings, facts);
  }

  /** Idempotent: records that the admin deferred the wizard (stops forced redirect). */
  async dismiss(user: AuthenticatedUser, condoId: string): Promise<SetupStatus> {
    this.assertCondoScope(user, condoId);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const stored = parseSetupState(condo.settings);
    if (stored.dismissedAt) {
      const facts = await this.deriveFacts(condo);
      return this.buildStatus(condoId, condo.settings, facts);
    }

    const merged = mergeSetupState(condo.settings, { dismissedAt: new Date().toISOString() });
    const updated = await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: merged as Prisma.InputJsonValue },
    });
    const facts = await this.deriveFacts(updated);
    return this.buildStatus(condoId, updated.settings, facts);
  }
}
