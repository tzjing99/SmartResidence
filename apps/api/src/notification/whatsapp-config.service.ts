import { SecretEncryptionService } from '@/billing/crypto/secret-encryption.service';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, type Prisma, RoleId } from '@prisma/client';
import {
  type WhatsAppConfigView,
  type WhatsAppTestSendResult,
  isValidMalaysiaPhone,
  normalizeMalaysiaPhone,
  resolveMalaysiaPhoneE164,
} from '@smartresidence/shared-types';
import type { UpdateWhatsAppConfigDto } from './dto/whatsapp.dto';
import {
  WHATSAPP_NOTIFICATION_PROVIDER,
  type WhatsAppCredentials,
  type WhatsAppNotificationProvider,
} from './providers/whatsapp-notification.provider.interface';
import {
  hasWhatsAppSecret,
  mergeWhatsAppConfig,
  parseWhatsAppConfig,
  readWhatsAppSecret,
  writeWhatsAppSecret,
} from './whatsapp-settings';

@Injectable()
export class WhatsAppConfigService {
  private readonly logger = new Logger(WhatsAppConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SecretEncryptionService,
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly provider: WhatsAppNotificationProvider,
  ) {}

  async getConfig(actor: AuthenticatedUser, condoId: string): Promise<WhatsAppConfigView> {
    this.assertCondoManagement(actor, condoId, false);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');
    return {
      ...parseWhatsAppConfig(condo.settings),
      apiKeyConfigured: hasWhatsAppSecret(condo.settings),
      updatedAt: condo.updatedAt.toISOString(),
    };
  }

  async updateConfig(
    actor: AuthenticatedUser,
    condoId: string,
    dto: UpdateWhatsAppConfigDto,
  ): Promise<WhatsAppConfigView> {
    this.assertCondoManagement(actor, condoId, true);
    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const { apiKey, ...configPatch } = dto;
    let settings = mergeWhatsAppConfig(condo.settings, configPatch);

    if (apiKey?.trim()) {
      const enc = this.encryption.encryptJson({ apiKey: apiKey.trim() } as Record<string, unknown>);
      settings = writeWhatsAppSecret(settings, {
        ciphertext: enc.ciphertext.toString('base64'),
        iv: enc.iv.toString('base64'),
        authTag: enc.authTag.toString('base64'),
        keyVersion: enc.keyVersion,
      });
    }

    const updated = await this.prisma.condo.update({
      where: { id: condoId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    return {
      ...parseWhatsAppConfig(updated.settings),
      apiKeyConfigured: hasWhatsAppSecret(updated.settings),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async testSend(
    actor: AuthenticatedUser,
    condoId: string,
    phone: string,
  ): Promise<WhatsAppTestSendResult> {
    this.assertCondoManagement(actor, condoId, true);
    const normalized = normalizeMalaysiaPhone(phone);
    if (!isValidMalaysiaPhone(normalized)) {
      throw new BadRequestException(
        'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
      );
    }
    const e164 = resolveMalaysiaPhoneE164(normalized);
    if (!e164) throw new BadRequestException('Could not resolve phone to E.164');

    const condo = await this.prisma.condo.findUnique({ where: { id: condoId } });
    if (!condo) throw new NotFoundException('Condo not found');

    const config = parseWhatsAppConfig(condo.settings);
    const credentials = this.resolveCredentials(condo.settings);

    const result = await this.provider.send({
      phoneNumberId: config.phoneNumberId,
      credentials,
      toE164: e164,
      kind: NotificationKind.PARCEL_RECEIVED,
      title: 'Test parcel received',
      body: 'This is a test message from SmartResidence. A parcel for Test Resident is ready for collection at the lobby — Unit A-01-01.',
      data: { recipientName: 'Test Resident', unitLabel: 'Unit A-01-01' },
    });

    return {
      ok: result.ok,
      mode: result.mode,
      messageId: result.messageId,
      detail: result.detail,
    };
  }

  /** Whether WhatsApp is enabled and minimally configured for a condo. */
  async isEnabledForCondo(condoId: string): Promise<boolean> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    if (!condo) return false;
    const config = parseWhatsAppConfig(condo.settings);
    return config.enabled && Boolean(config.phoneNumberId.trim());
  }

  /** Load decrypted credentials + public config for dispatch. */
  async resolveForDispatch(condoId: string): Promise<{
    enabled: boolean;
    phoneNumberId: string;
    credentials: WhatsAppCredentials | null;
  } | null> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    if (!condo) return null;
    const config = parseWhatsAppConfig(condo.settings);
    if (!config.enabled || !config.phoneNumberId.trim()) return null;
    return {
      enabled: true,
      phoneNumberId: config.phoneNumberId.trim(),
      credentials: this.resolveCredentials(condo.settings),
    };
  }

  private resolveCredentials(settings: unknown): WhatsAppCredentials | null {
    const envelope = readWhatsAppSecret(settings);
    if (!envelope) return null;
    try {
      const parsed = this.encryption.decryptJson<{ apiKey?: string }>({
        ciphertext: Buffer.from(envelope.ciphertext, 'base64'),
        iv: Buffer.from(envelope.iv, 'base64'),
        authTag: Buffer.from(envelope.authTag, 'base64'),
      });
      if (!parsed.apiKey?.trim()) return null;
      return { apiKey: parsed.apiKey.trim() };
    } catch (err) {
      this.logger.warn(`Failed to decrypt WhatsApp credentials: ${(err as Error).message}`);
      return null;
    }
  }

  private assertCondoManagement(
    actor: AuthenticatedUser,
    condoId: string,
    requireAdmin: boolean,
  ): void {
    const allowed = actor.roles.filter((r) => r.condoId === condoId || r.condoId === null);
    const isAdmin = allowed.some((r) => r.roleId === RoleId.MANAGEMENT_ADMIN);
    const isStaff = allowed.some((r) => r.roleId === RoleId.MANAGEMENT_STAFF);
    const isSuper = allowed.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (isSuper || isAdmin) return;
    if (!requireAdmin && isStaff) return;
    throw new ForbiddenException('Management access required');
  }
}
