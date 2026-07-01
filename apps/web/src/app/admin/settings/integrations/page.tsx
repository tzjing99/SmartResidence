'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useDeleteMcpServer,
  useMcpServers,
  useMyCondos,
  useSetMcpServerEnabled,
  useTestMcpServer,
  useUpsertMcpServer,
} from '@smartresidence/api-client';
import type { McpServerConnectionView, McpTransport } from '@smartresidence/shared-types';
import { MCP_TRANSPORT_HELP, MCP_TRANSPORT_LABELS } from '@smartresidence/shared-types';
import { Badge, Button, Card, EmptyState, Input, Label, Skeleton } from '@smartresidence/ui-web';
import { Plug, ShieldCheck, Trash2, Zap } from 'lucide-react';
import * as React from 'react';

const selectCls = 'sr-select';

const TRANSPORTS: McpTransport[] = ['STREAMABLE_HTTP', 'HTTP_SSE', 'STDIO'];

function testBadge(status: McpServerConnectionView['lastTestStatus']) {
  if (status === 'OK') return <Badge tone="success">Connected</Badge>;
  if (status === 'FAILED') return <Badge tone="danger">Test failed</Badge>;
  return <Badge tone="neutral">Not tested</Badge>;
}

export default function IntegrationsSettingsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const condoId = condo?.id ?? null;
  const servers = useMcpServers(api, condoId);
  const upsert = useUpsertMcpServer(api);
  const testConn = useTestMcpServer(api);
  const setEnabled = useSetMcpServerEnabled(api);
  const remove = useDeleteMcpServer(api);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [transport, setTransport] = React.useState<McpTransport>('STREAMABLE_HTTP');
  const [serverUrl, setServerUrl] = React.useState('');
  const [authToken, setAuthToken] = React.useState('');
  const [stdioCommand, setStdioCommand] = React.useState('');
  const [stdioArgs, setStdioArgs] = React.useState('');

  const resetForm = () => {
    setEditingId(null);
    setDisplayName('');
    setTransport('STREAMABLE_HTTP');
    setServerUrl('');
    setAuthToken('');
    setStdioCommand('');
    setStdioArgs('');
  };

  const loadForEdit = (row: McpServerConnectionView) => {
    setEditingId(row.id);
    setDisplayName(row.displayName);
    setTransport(row.transport);
    setServerUrl(row.serverUrl ?? '');
    setAuthToken('');
    const cfg = row.publicConfig as { command?: string; args?: string[] };
    setStdioCommand(cfg.command ?? '');
    setStdioArgs((cfg.args ?? []).join(' '));
  };

  const save = async () => {
    if (!condoId) return;
    try {
      const publicConfig =
        transport === 'STDIO'
          ? {
              command: stdioCommand.trim(),
              args: stdioArgs
                .split(/\s+/)
                .map((a) => a.trim())
                .filter(Boolean),
            }
          : undefined;

      await upsert.mutateAsync({
        condoId,
        input: {
          id: editingId ?? undefined,
          displayName: displayName.trim(),
          transport,
          serverUrl: transport === 'STDIO' ? undefined : serverUrl.trim(),
          publicConfig,
          authToken: authToken.trim() || undefined,
        },
      });
      toast.success(editingId ? 'MCP connection updated' : 'MCP connection saved');
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save MCP connection');
    }
  };

  const runTest = async (id: string) => {
    if (!condoId) return;
    try {
      const result = await testConn.mutateAsync({ condoId, id });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed');
    }
  };

  if (condos.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!condoId) {
    return (
      <EmptyState
        title="No condo selected"
        description="Sign in as management to configure integrations."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Plug className="size-5 text-[rgb(var(--sr-coral))]" />
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm sr-muted">
          Connect Model Context Protocol (MCP) servers so SmartResidence assistants can use approved
          tools — billing lookups, visitor logs, helpdesk context — with credentials stored
          encrypted and never shown again after saving.
        </p>
      </div>

      <Card className="border-[rgb(var(--sr-coral)/0.25)] bg-[rgb(var(--message-mgmt-coral-bg))]/30">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[rgb(var(--sr-coral))]" />
          <div className="text-sm leading-relaxed sr-muted">
            <p className="font-medium text-[rgb(var(--sr-fg))]">
              Trust only MCP servers you control
            </p>
            <p className="mt-1">
              An MCP server can expose tools that read condo data. Connect vetted endpoints only,
              use HTTPS where possible, and rotate bearer tokens if a connection is compromised.
              Auth tokens are encrypted at rest and are never returned to the browser.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          {editingId ? 'Edit MCP server' : 'Add MCP server'}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mcp-name">Display name</Label>
            <Input
              id="mcp-name"
              placeholder="e.g. Building ops tools"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-transport">Transport</Label>
            <select
              id="mcp-transport"
              className={selectCls}
              value={transport}
              onChange={(e) => setTransport(e.target.value as McpTransport)}
            >
              {TRANSPORTS.map((t) => (
                <option key={t} value={t}>
                  {MCP_TRANSPORT_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="text-xs sr-muted">{MCP_TRANSPORT_HELP[transport]}</p>
          </div>
          {transport !== 'STDIO' ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input
                id="mcp-url"
                placeholder="https://mcp.example.com/mcp"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="mcp-cmd">Command</Label>
                <Input
                  id="mcp-cmd"
                  placeholder="npx"
                  value={stdioCommand}
                  onChange={(e) => setStdioCommand(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-args">Arguments (space-separated)</Label>
                <Input
                  id="mcp-args"
                  placeholder="-y @modelcontextprotocol/server-filesystem /data"
                  value={stdioArgs}
                  onChange={(e) => setStdioArgs(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mcp-token">Bearer token / API key (optional, write-only)</Label>
            <Input
              id="mcp-token"
              type="password"
              placeholder={editingId ? 'Leave blank to keep existing token' : 'sk-…'}
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={save} disabled={upsert.isPending || !displayName.trim()}>
            {editingId ? 'Save changes' : 'Save connection'}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Connected servers</h2>
        {servers.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !servers.data?.length ? (
          <EmptyState
            title="No MCP servers yet"
            description="Add a connection above, test it, then enable it for assistants to use."
          />
        ) : (
          servers.data.map((row) => (
            <Card
              key={row.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.displayName}</span>
                  {testBadge(row.lastTestStatus)}
                  {row.enabled ? (
                    <Badge tone="success">Enabled</Badge>
                  ) : (
                    <Badge tone="neutral">Disabled</Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-sm sr-muted">
                  {MCP_TRANSPORT_LABELS[row.transport]}
                  {row.serverUrl ? ` · ${row.serverUrl}` : ''}
                </p>
                {row.lastTestMessage ? (
                  <p className="mt-1 text-xs sr-muted">{row.lastTestMessage}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runTest(row.id)}
                  disabled={testConn.isPending}
                >
                  <Zap className="size-3.5" />
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setEnabled.mutate(
                      { condoId, id: row.id, enabled: !row.enabled },
                      {
                        onSuccess: () =>
                          toast.success(row.enabled ? 'Connection disabled' : 'Connection enabled'),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                  disabled={setEnabled.isPending || (!row.enabled && row.lastTestStatus !== 'OK')}
                >
                  {row.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => loadForEdit(row)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    remove.mutate(
                      { condoId, id: row.id },
                      {
                        onSuccess: () => {
                          toast.success('Connection removed');
                          if (editingId === row.id) resetForm();
                        },
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
