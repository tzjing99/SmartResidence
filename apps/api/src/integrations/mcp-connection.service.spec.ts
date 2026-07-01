import { SecretEncryptionService } from '@/billing/crypto/secret-encryption.service';
import { BadRequestException } from '@nestjs/common';
import { McpConnectionTestStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpConnectionService } from './mcp-connection.service';

describe('McpConnectionService', () => {
  const prisma = {
    mcpServerConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const encryption = {
    encrypt: vi.fn(() => ({
      ciphertext: Buffer.from('cipher'),
      iv: Buffer.from('iv'),
      authTag: Buffer.from('tag'),
      keyVersion: 1,
    })),
    decrypt: vi.fn(() => 'token'),
  } as unknown as SecretEncryptionService;

  let svc: McpConnectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new McpConnectionService(prisma as never, encryption);
  });

  it('blocks enable when connection was never tested successfully', async () => {
    prisma.mcpServerConnection.findFirst.mockResolvedValue({
      id: 'm1',
      condoId: 'c1',
      lastTestStatus: McpConnectionTestStatus.UNTESTED,
    });
    await expect(svc.setEnabled('c1', 'm1', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires server URL for remote transports on upsert', async () => {
    await expect(
      svc.upsert(
        'c1',
        {
          displayName: 'Ops',
          transport: 'STREAMABLE_HTTP',
        },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
