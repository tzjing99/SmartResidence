import type { McpServerConnection } from '@prisma/client';
import type {
  McpConnectionTestResult,
  McpServerConnectionView,
  UpsertMcpServerInput,
} from '@smartresidence/shared-types';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const CLIENT_INFO = { name: 'smartresidence', version: '0.1.0' };

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number;
  result?: {
    serverInfo?: { name?: string; version?: string };
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
  };
  error?: { code?: number; message?: string };
};

function parseJsonRpcBody(text: string): JsonRpcResponse | null {
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    return null;
  }
}

/** Extract the first JSON object from an SSE or mixed response body. */
function extractJsonFromSse(text: string): JsonRpcResponse | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    const parsed = parseJsonRpcBody(payload);
    if (parsed) return parsed;
  }
  return parseJsonRpcBody(text);
}

export async function probeMcpHttpServer(input: {
  serverUrl: string;
  authToken?: string;
  transport: 'STREAMABLE_HTTP' | 'HTTP_SSE';
}): Promise<McpConnectionTestResult> {
  const testedAt = new Date().toISOString();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (input.authToken?.trim()) {
    headers.Authorization = `Bearer ${input.authToken.trim()}`;
  }

  const initializeBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
  };

  let initResponse: JsonRpcResponse | null = null;
  try {
    const res = await fetch(input.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(initializeBody),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        message: `Server returned HTTP ${res.status}: ${text.slice(0, 200)}`,
        testedAt,
      };
    }
    initResponse =
      input.transport === 'HTTP_SSE' ? extractJsonFromSse(text) : parseJsonRpcBody(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, message, testedAt };
  }

  if (!initResponse?.result) {
    const errMsg = initResponse?.error?.message ?? 'No initialize result from MCP server';
    return { ok: false, message: errMsg, testedAt };
  }

  const serverName = initResponse.result.serverInfo?.name ?? 'MCP server';
  const protocolVersion = initResponse.result.protocolVersion ?? MCP_PROTOCOL_VERSION;

  let toolCount: number | undefined;
  try {
    const toolsRes = await fetch(input.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(15_000),
    });
    const toolsText = await toolsRes.text();
    const toolsParsed =
      input.transport === 'HTTP_SSE' ? extractJsonFromSse(toolsText) : parseJsonRpcBody(toolsText);
    const tools = (toolsParsed?.result as { tools?: unknown[] } | undefined)?.tools;
    if (Array.isArray(tools)) toolCount = tools.length;
  } catch {
    // tools/list is optional for a successful handshake
  }

  const toolHint = toolCount != null ? ` · ${toolCount} tool(s) available` : '';
  return {
    ok: true,
    message: `Connected to ${serverName}${toolHint}`,
    serverName,
    protocolVersion,
    toolCount,
    testedAt,
  };
}

export function probeMcpStdioConfig(
  publicConfig: Record<string, unknown>,
): McpConnectionTestResult {
  const testedAt = new Date().toISOString();
  const command = typeof publicConfig.command === 'string' ? publicConfig.command.trim() : '';
  if (!command) {
    return { ok: false, message: 'Stdio command is required', testedAt };
  }
  return {
    ok: true,
    message: `Stdio command "${command}" saved — validated when the server process starts`,
    testedAt,
  };
}

export function toMcpConnectionView(conn: McpServerConnection): McpServerConnectionView {
  return {
    id: conn.id,
    displayName: conn.displayName,
    transport: conn.transport,
    serverUrl: conn.serverUrl,
    publicConfig: (conn.publicConfig as Record<string, unknown>) ?? {},
    configured: Boolean(conn.encryptedSecret),
    enabled: conn.enabled,
    lastTestStatus: conn.lastTestStatus,
    lastTestMessage: conn.lastTestMessage,
    lastTestedAt: conn.lastTestedAt?.toISOString() ?? null,
    updatedAt: conn.updatedAt.toISOString(),
  };
}

export type ResolvedMcpCredentials = {
  authToken?: string;
  publicConfig: Record<string, unknown>;
  serverUrl?: string | null;
  transport: McpServerConnection['transport'];
};

export function resolveMcpCredentialsForRuntime(
  conn: McpServerConnection,
  decrypt: (secret: {
    ciphertext: Buffer | Uint8Array;
    iv: Buffer | Uint8Array;
    authTag: Buffer | Uint8Array;
  }) => string,
): ResolvedMcpCredentials | null {
  if (!conn.enabled) return null;
  let authToken: string | undefined;
  if (conn.encryptedSecret && conn.secretIv && conn.secretAuthTag) {
    authToken = decrypt({
      ciphertext: conn.encryptedSecret,
      iv: conn.secretIv,
      authTag: conn.secretAuthTag,
    });
  }
  return {
    authToken,
    publicConfig: (conn.publicConfig as Record<string, unknown>) ?? {},
    serverUrl: conn.serverUrl,
    transport: conn.transport,
  };
}

export type { UpsertMcpServerInput };
