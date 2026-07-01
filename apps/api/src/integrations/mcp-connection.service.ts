import { SecretEncryptionService } from '@/billing/crypto/secret-encryption.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  McpConnectionTestStatus,
  type McpServerConnection,
  type McpTransport,
  type Prisma,
} from '@prisma/client';
import type {
  McpConnectionTestResult,
  McpServerConnectionView,
  UpsertMcpServerInput,
} from '@smartresidence/shared-types';
import {
  probeMcpHttpServer,
  probeMcpStdioConfig,
  resolveMcpCredentialsForRuntime,
  toMcpConnectionView,
} from './mcp-client';

@Injectable()
export class McpConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SecretEncryptionService,
  ) {}

  async listForCondo(condoId: string): Promise<McpServerConnectionView[]> {
    const rows = await this.prisma.mcpServerConnection.findMany({
      where: { condoId },
      orderBy: [{ enabled: 'desc' }, { displayName: 'asc' }],
    });
    return rows.map(toMcpConnectionView);
  }

  async upsert(
    condoId: string,
    dto: UpsertMcpServerInput,
    actorUserId: string,
  ): Promise<McpServerConnectionView> {
    this.assertTransportConfig(dto);

    const existing = dto.id
      ? await this.prisma.mcpServerConnection.findFirst({ where: { id: dto.id, condoId } })
      : null;
    if (dto.id && !existing) throw new NotFoundException('MCP connection not found');

    const secretData = dto.authToken?.trim()
      ? (() => {
          const token = dto.authToken.trim();
          const enc = this.encryption.encrypt(token);
          return {
            encryptedSecret: enc.ciphertext,
            secretIv: enc.iv,
            secretAuthTag: enc.authTag,
            keyVersion: enc.keyVersion,
          };
        })()
      : null;

    const requestedEnabled = dto.enabled ?? existing?.enabled ?? false;
    const canEnable = existing?.lastTestStatus === McpConnectionTestStatus.OK;
    const enabled = requestedEnabled && canEnable;

    const data: Prisma.McpServerConnectionCreateInput = {
      condo: { connect: { id: condoId } },
      displayName: dto.displayName.trim(),
      transport: dto.transport as McpTransport,
      serverUrl: dto.transport === 'STDIO' ? null : (dto.serverUrl?.trim() ?? null),
      publicConfig: (dto.publicConfig ?? existing?.publicConfig ?? {}) as Prisma.InputJsonValue,
      enabled,
      createdByUserId: existing?.createdByUserId ?? actorUserId,
      ...(secretData ?? {}),
    };

    const conn = existing
      ? await this.prisma.mcpServerConnection.update({
          where: { id: existing.id },
          data: {
            displayName: data.displayName,
            transport: data.transport,
            serverUrl: data.serverUrl,
            publicConfig: data.publicConfig,
            enabled: data.enabled,
            ...(secretData ?? {}),
          },
        })
      : await this.prisma.mcpServerConnection.create({ data });

    if (requestedEnabled && !enabled) {
      throw new BadRequestException('Test the MCP connection successfully before enabling it');
    }

    return toMcpConnectionView(conn);
  }

  async setEnabled(
    condoId: string,
    id: string,
    enabled: boolean,
  ): Promise<McpServerConnectionView> {
    const conn = await this.requireConn(condoId, id);
    if (enabled && conn.lastTestStatus !== McpConnectionTestStatus.OK) {
      throw new BadRequestException('Run a successful connection test before enabling');
    }
    const updated = await this.prisma.mcpServerConnection.update({
      where: { id },
      data: { enabled },
    });
    return toMcpConnectionView(updated);
  }

  async remove(condoId: string, id: string) {
    await this.requireConn(condoId, id);
    await this.prisma.mcpServerConnection.delete({ where: { id } });
    return { deleted: true };
  }

  async testConnection(condoId: string, id: string): Promise<McpConnectionTestResult> {
    const conn = await this.requireConn(condoId, id);
    const creds = resolveMcpCredentialsForRuntime(conn, (secret) =>
      this.encryption.decrypt(secret),
    );

    let result: McpConnectionTestResult;
    if (conn.transport === 'STDIO') {
      result = probeMcpStdioConfig(creds?.publicConfig ?? {});
    } else {
      if (!conn.serverUrl) {
        result = {
          ok: false,
          message: 'Server URL is required',
          testedAt: new Date().toISOString(),
        };
      } else {
        result = await probeMcpHttpServer({
          serverUrl: conn.serverUrl,
          authToken: creds?.authToken,
          transport: conn.transport,
        });
      }
    }

    await this.prisma.mcpServerConnection.update({
      where: { id },
      data: {
        lastTestStatus: result.ok ? McpConnectionTestStatus.OK : McpConnectionTestStatus.FAILED,
        lastTestMessage: result.message,
        lastTestedAt: new Date(result.testedAt),
        ...(result.ok ? {} : { enabled: false }),
      },
    });

    return result;
  }

  /** Enabled connections for runtime AI/automation consumers. */
  async listEnabledForCondo(condoId: string): Promise<McpServerConnection[]> {
    return this.prisma.mcpServerConnection.findMany({
      where: { condoId, enabled: true },
      orderBy: { displayName: 'asc' },
    });
  }

  private async requireConn(condoId: string, id: string): Promise<McpServerConnection> {
    const conn = await this.prisma.mcpServerConnection.findFirst({ where: { id, condoId } });
    if (!conn) throw new NotFoundException('MCP connection not found');
    return conn;
  }

  private assertTransportConfig(dto: UpsertMcpServerInput) {
    if (dto.transport === 'STDIO') {
      const command = (dto.publicConfig as { command?: string } | undefined)?.command?.trim();
      if (!command) {
        throw new BadRequestException('Stdio transport requires a command in publicConfig');
      }
      return;
    }
    if (!dto.serverUrl?.trim()) {
      throw new BadRequestException('Remote MCP transports require a server URL');
    }
  }
}
