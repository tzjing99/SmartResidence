import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type GatewayMode,
  type PaymentGatewayConnection,
  PaymentProvider,
  type Prisma,
} from '@prisma/client';
import {
  CONNECTABLE_PROVIDERS,
  GATEWAY_PROVIDER_LABELS,
  type GatewayConnectionView,
  type PayableMethod,
  type UpsertGatewayInput,
} from '@smartresidence/shared-types';
import { SecretEncryptionService } from './crypto/secret-encryption.service';

@Injectable()
export class GatewayConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SecretEncryptionService,
  ) {}

  private toView(conn: PaymentGatewayConnection): GatewayConnectionView {
    return {
      id: conn.id,
      provider: conn.provider,
      mode: conn.mode,
      enabled: conn.enabled,
      displayName: conn.displayName,
      publicConfig: (conn.publicConfig as Record<string, unknown>) ?? {},
      configured: Boolean(conn.encryptedSecret),
      updatedAt: conn.updatedAt.toISOString(),
    };
  }

  async listForCondo(condoId: string): Promise<GatewayConnectionView[]> {
    const conns = await this.prisma.paymentGatewayConnection.findMany({
      where: { condoId },
      orderBy: { provider: 'asc' },
    });
    return conns.map((c) => this.toView(c));
  }

  async upsert(
    condoId: string,
    dto: UpsertGatewayInput,
    actorUserId: string,
  ): Promise<GatewayConnectionView> {
    if (!CONNECTABLE_PROVIDERS.includes(dto.provider)) {
      throw new BadRequestException(`Provider ${dto.provider} cannot be self-connected`);
    }

    const existing = await this.prisma.paymentGatewayConnection.findUnique({
      where: {
        condoId_provider_mode: { condoId, provider: dto.provider, mode: dto.mode },
      },
    });

    const secretData =
      dto.credentials && Object.keys(dto.credentials).length > 0
        ? (() => {
            const enc = this.encryption.encryptJson(dto.credentials as Record<string, unknown>);
            return {
              encryptedSecret: enc.ciphertext,
              secretIv: enc.iv,
              secretAuthTag: enc.authTag,
              keyVersion: enc.keyVersion,
            };
          })()
        : null;

    const data = {
      condoId,
      provider: dto.provider,
      mode: dto.mode,
      enabled: dto.enabled ?? existing?.enabled ?? false,
      displayName:
        dto.displayName ?? existing?.displayName ?? GATEWAY_PROVIDER_LABELS[dto.provider],
      publicConfig: (dto.publicConfig ?? existing?.publicConfig ?? {}) as Prisma.InputJsonValue,
      createdByUserId: existing?.createdByUserId ?? actorUserId,
      ...(secretData ?? {}),
    };

    const conn = await this.prisma.paymentGatewayConnection.upsert({
      where: { condoId_provider_mode: { condoId, provider: dto.provider, mode: dto.mode } },
      update: data,
      create: data,
    });
    return this.toView(conn);
  }

  async setEnabled(condoId: string, id: string, enabled: boolean): Promise<GatewayConnectionView> {
    const conn = await this.prisma.paymentGatewayConnection.findFirst({ where: { id, condoId } });
    if (!conn) throw new NotFoundException('Gateway connection not found');
    if (enabled && !conn.encryptedSecret) {
      throw new BadRequestException('Add credentials before enabling this gateway');
    }
    if (enabled) {
      await this.prisma.paymentGatewayConnection.updateMany({
        where: { condoId, provider: conn.provider, id: { not: id } },
        data: { enabled: false },
      });
    }
    const updated = await this.prisma.paymentGatewayConnection.update({
      where: { id },
      data: { enabled },
    });
    return this.toView(updated);
  }

  async remove(condoId: string, id: string) {
    const conn = await this.prisma.paymentGatewayConnection.findFirst({ where: { id, condoId } });
    if (!conn) throw new NotFoundException('Gateway connection not found');
    await this.prisma.paymentGatewayConnection.delete({ where: { id } });
    return { deleted: true };
  }

  /** Methods a resident can pay with right now (enabled + configured gateways). */
  async payableMethods(condoId: string): Promise<PayableMethod[]> {
    const conns = await this.prisma.paymentGatewayConnection.findMany({
      where: { condoId, enabled: true, NOT: { encryptedSecret: null } },
    });
    return conns.map((c) => ({
      provider: c.provider,
      mode: c.mode,
      label: c.displayName ?? GATEWAY_PROVIDER_LABELS[c.provider] ?? c.provider,
    }));
  }

  /** Resolve an active connection with decrypted credentials for an adapter. */
  async resolveCredentials(
    condoId: string,
    provider: PaymentProvider,
  ): Promise<{
    mode: GatewayMode;
    credentials: Record<string, string>;
    publicConfig: Record<string, unknown>;
  } | null> {
    const conn = await this.prisma.paymentGatewayConnection.findFirst({
      where: { condoId, provider, enabled: true, NOT: { encryptedSecret: null } },
      orderBy: { mode: 'asc' },
    });
    if (!conn?.encryptedSecret || !conn.secretIv || !conn.secretAuthTag) return null;
    const credentials = this.encryption.decryptJson<Record<string, string>>({
      ciphertext: conn.encryptedSecret,
      iv: conn.secretIv,
      authTag: conn.secretAuthTag,
    });
    return {
      mode: conn.mode,
      credentials,
      publicConfig: (conn.publicConfig as Record<string, unknown>) ?? {},
    };
  }
}
