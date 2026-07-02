import type { AuthenticatedUser } from '@/common/types/request-context';
import { ForbiddenException } from '@nestjs/common';
import { RoleId } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { McpConnectionController } from './mcp-connection.controller';
import type { McpConnectionService } from './mcp-connection.service';

const CONDO_A = 'condo-a';
const CONDO_B = 'condo-b';

function managementAdminOfCondoA(): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'a@b.c',
    name: 'Admin',
    locale: 'en',
    activeCondoId: CONDO_A,
    activeRole: RoleId.MANAGEMENT_ADMIN,
    roles: [{ roleId: RoleId.MANAGEMENT_ADMIN, condoId: CONDO_A, unitId: null, permissions: [] }],
  } as unknown as AuthenticatedUser;
}

function makeController() {
  const mcp = {
    listForCondo: vi.fn(async () => []),
    upsert: vi.fn(async () => ({})),
    testConnection: vi.fn(async () => ({ ok: true, testedAt: new Date().toISOString() })),
    setEnabled: vi.fn(async () => ({})),
    remove: vi.fn(async () => ({ deleted: true })),
  } as unknown as McpConnectionService;
  return { controller: new McpConnectionController(mcp), mcp };
}

describe('McpConnectionController — cross-condo authorization', () => {
  it('blocks listing MCP connections for a condo the actor does not manage', () => {
    const { controller, mcp } = makeController();
    expect(() => controller.list(managementAdminOfCondoA(), CONDO_B)).toThrow(ForbiddenException);
    expect(mcp.listForCondo).not.toHaveBeenCalled();
  });

  it('blocks upserting a connection (with secrets) for a condo the actor does not manage', () => {
    const { controller, mcp } = makeController();
    expect(() =>
      controller.upsert(managementAdminOfCondoA(), CONDO_B, {
        displayName: 'Ops bot',
        transport: 'STREAMABLE_HTTP',
        serverUrl: 'https://example.com',
        authToken: 'super-secret-token',
      } as never),
    ).toThrow(ForbiddenException);
    expect(mcp.upsert).not.toHaveBeenCalled();
  });

  it('blocks testing a connection for a condo the actor does not manage', () => {
    const { controller, mcp } = makeController();
    expect(() => controller.test(managementAdminOfCondoA(), CONDO_B, 'conn-1')).toThrow(
      ForbiddenException,
    );
    expect(mcp.testConnection).not.toHaveBeenCalled();
  });

  it('blocks enabling/disabling a connection for a condo the actor does not manage', () => {
    const { controller, mcp } = makeController();
    expect(() =>
      controller.setEnabled(managementAdminOfCondoA(), CONDO_B, 'conn-1', { enabled: true }),
    ).toThrow(ForbiddenException);
    expect(mcp.setEnabled).not.toHaveBeenCalled();
  });

  it('blocks removing a connection for a condo the actor does not manage', () => {
    const { controller, mcp } = makeController();
    expect(() => controller.remove(managementAdminOfCondoA(), CONDO_B, 'conn-1')).toThrow(
      ForbiddenException,
    );
    expect(mcp.remove).not.toHaveBeenCalled();
  });

  it("allows listing MCP connections for the actor's own condo", () => {
    const { controller, mcp } = makeController();
    controller.list(managementAdminOfCondoA(), CONDO_A);
    expect(mcp.listForCondo).toHaveBeenCalledWith(CONDO_A);
  });
});
