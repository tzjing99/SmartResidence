import { z } from 'zod';

export const McpTransport = z.enum(['STREAMABLE_HTTP', 'HTTP_SSE', 'STDIO']);
export type McpTransport = z.infer<typeof McpTransport>;

export const McpConnectionTestStatus = z.enum(['UNTESTED', 'OK', 'FAILED']);
export type McpConnectionTestStatus = z.infer<typeof McpConnectionTestStatus>;

export const MCP_TRANSPORT_LABELS: Record<McpTransport, string> = {
  STREAMABLE_HTTP: 'Streamable HTTP (recommended)',
  HTTP_SSE: 'HTTP + SSE',
  STDIO: 'Local process (stdio)',
};

export const MCP_TRANSPORT_HELP: Record<McpTransport, string> = {
  STREAMABLE_HTTP:
    'Connect to a remote MCP server over HTTPS. Works with most hosted MCP endpoints.',
  HTTP_SSE: 'Legacy SSE transport — use when your provider exposes an /sse endpoint.',
  STDIO:
    'Run a local MCP server process on the SmartResidence host (self-hosted deployments only).',
};

/** Non-secret stdio config stored in publicConfig. */
export const McpStdioConfigSchema = z.object({
  command: z.string().min(1).max(200),
  args: z.array(z.string().max(500)).max(20).default([]),
  cwd: z.string().max(500).optional(),
});
export type McpStdioConfig = z.infer<typeof McpStdioConfigSchema>;

export const McpServerConnectionViewSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  transport: McpTransport,
  serverUrl: z.string().nullable().optional(),
  publicConfig: z.record(z.unknown()).default({}),
  configured: z.boolean(),
  enabled: z.boolean(),
  lastTestStatus: McpConnectionTestStatus,
  lastTestMessage: z.string().nullable().optional(),
  lastTestedAt: z.string().nullable().optional(),
  updatedAt: z.string(),
});
export type McpServerConnectionView = z.infer<typeof McpServerConnectionViewSchema>;

export const UpsertMcpServerInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    displayName: z.string().min(2).max(120),
    transport: McpTransport,
    serverUrl: z.string().url().optional(),
    publicConfig: z.record(z.unknown()).optional(),
    /** Write-only bearer token or API key. Never returned after save. */
    authToken: z.string().max(2000).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.transport === 'STDIO') {
      const parsed = McpStdioConfigSchema.safeParse(data.publicConfig ?? {});
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Stdio connections require command (and optional args) in config',
          path: ['publicConfig'],
        });
      }
      return;
    }
    if (!data.serverUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Server URL is required for remote MCP transports',
        path: ['serverUrl'],
      });
    }
  });
export type UpsertMcpServerInput = z.infer<typeof UpsertMcpServerInputSchema>;

export const McpConnectionTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  serverName: z.string().optional(),
  protocolVersion: z.string().optional(),
  toolCount: z.number().int().optional(),
  testedAt: z.string(),
});
export type McpConnectionTestResult = z.infer<typeof McpConnectionTestResultSchema>;
