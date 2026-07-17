'use client';

import { type UnitSearchItem, UnitSearchPicker } from '@/components/unit-search-picker';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useAccessRestrictionSettings,
  useAccessRestrictionUnits,
  useClearAccessUnit,
  useMyCondos,
  useRecomputeAccessRestrictions,
  useRestrictAccessUnit,
  useUpdateAccessRestrictionSettings,
} from '@smartresidence/api-client';
import type {
  AccessRestrictionZone,
  CondoAccessRestrictionSettings,
  UnitAccessRestrictionView,
  UpdateCondoAccessRestrictionSettingsInput,
} from '@smartresidence/shared-types';
import {
  ACCESS_RESTRICTION_ZONE_LABELS,
  formatMoney,
} from '@smartresidence/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@smartresidence/ui-web';
import { Download, RefreshCw, Save, ShieldOff } from 'lucide-react';
import * as React from 'react';

type OpsFilter = 'active' | 'cleared' | 'all';

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function matchesOpsFilter(row: UnitAccessRestrictionView, filter: OpsFilter) {
  if (filter === 'active') return row.active;
  if (filter === 'cleared') return !row.active || row.manualExempt;
  return true;
}

function matchesOpsSearch(row: UnitAccessRestrictionView, q: string) {
  if (!q) return true;
  const hay = [
    row.unitIdentifier,
    row.blockName ?? '',
    row.reason ?? '',
    row.source,
    ...row.zones,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

const ALL_ZONES: AccessRestrictionZone[] = ['CAR_PARK', 'AMENITIES', 'COMMON_FACILITIES'];

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Editable = {
  enabled: boolean;
  graceDays: number;
  minOutstanding: number;
  softBlockFacility: boolean;
  softBlockVisitors: boolean;
  softBlockDeliveryPasses: boolean;
  softBlockRecurringPasses: boolean;
  zones: AccessRestrictionZone[];
  webhookUrl: string;
  webhookSecret: string;
  autoSyncEnabled: boolean;
};

function toEditable(s: CondoAccessRestrictionSettings): Editable {
  return {
    enabled: s.enabled,
    graceDays: s.graceDays,
    minOutstanding: s.minOutstanding,
    softBlockFacility: s.softBlockFacility,
    softBlockVisitors: s.softBlockVisitors,
    softBlockDeliveryPasses: s.softBlockDeliveryPasses,
    softBlockRecurringPasses: s.softBlockRecurringPasses,
    zones: [...s.zones],
    webhookUrl: s.webhookUrl ?? '',
    webhookSecret: '',
    autoSyncEnabled: s.autoSyncEnabled,
  };
}

export default function AccessRestrictionSettingsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const condoId = condo?.id ?? null;
  const settingsQ = useAccessRestrictionSettings(api, condoId);
  const unitsQ = useAccessRestrictionUnits(api, condoId);
  const update = useUpdateAccessRestrictionSettings(api);
  const recompute = useRecomputeAccessRestrictions(api);
  const restrict = useRestrictAccessUnit(api);
  const clear = useClearAccessUnit(api);

  const [form, setForm] = React.useState<Editable | null>(null);
  const [manualUnit, setManualUnit] = React.useState<UnitSearchItem | null>(null);
  const [manualReason, setManualReason] = React.useState('');
  const [opsFilter, setOpsFilter] = React.useState<OpsFilter>('active');
  const [opsSearch, setOpsSearch] = React.useState('');

  React.useEffect(() => {
    if (settingsQ.data) setForm(toEditable(settingsQ.data));
  }, [settingsQ.data]);

  const filteredRows = React.useMemo(() => {
    const items = unitsQ.data?.items ?? [];
    const q = opsSearch.trim().toLowerCase();
    return items.filter((row) => matchesOpsFilter(row, opsFilter) && matchesOpsSearch(row, q));
  }, [unitsQ.data?.items, opsFilter, opsSearch]);

  const dirty = React.useMemo(() => {
    if (!form || !settingsQ.data) return false;
    const base = toEditable(settingsQ.data);
    return JSON.stringify({ ...form, webhookSecret: '' }) !== JSON.stringify({ ...base, webhookSecret: '' })
      || form.webhookSecret.trim().length > 0;
  }, [form, settingsQ.data]);

  const save = async () => {
    if (!condoId || !form) return;
    const data: UpdateCondoAccessRestrictionSettingsInput = {
      enabled: form.enabled,
      graceDays: form.graceDays,
      minOutstanding: form.minOutstanding,
      softBlockFacility: form.softBlockFacility,
      softBlockVisitors: form.softBlockVisitors,
      softBlockDeliveryPasses: form.softBlockDeliveryPasses,
      softBlockRecurringPasses: form.softBlockRecurringPasses,
      zones: form.zones,
      webhookUrl: form.webhookUrl.trim() ? form.webhookUrl.trim() : null,
      autoSyncEnabled: form.autoSyncEnabled,
    };
    if (form.webhookSecret.trim()) data.webhookSecret = form.webhookSecret.trim();
    try {
      await update.mutateAsync({ condoId, data });
      toast.success('Access restriction settings saved');
      setForm((f) => (f ? { ...f, webhookSecret: '' } : f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const toggleZone = (zone: AccessRestrictionZone) => {
    setForm((f) => {
      if (!f) return f;
      const has = f.zones.includes(zone);
      if (has && f.zones.length === 1) return f;
      return {
        ...f,
        zones: has ? f.zones.filter((z) => z !== zone) : [...f.zones, zone],
      };
    });
  };

  if (condos.isLoading || settingsQ.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!condoId || !form) {
    return (
      <div className="p-6">
        <EmptyState title="No condo" description="Select a condo context to manage arrears access." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Arrears access</h1>
        <p className="text-sm text-muted-foreground">
          Soft-block amenity booking and visitor passes when maintenance is unpaid. Export the
          restricted list for your ZKTeco / MAG integrator — this does not lock unit doors.
        </p>
      </header>

      <Card className="space-y-5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Enable policy</p>
            <p className="text-sm text-muted-foreground">
              Auto-restrict units after due date + grace days.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm((f) => (f ? { ...f, enabled } : f))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="graceDays">Grace days after due date</Label>
            <Input
              id="graceDays"
              type="number"
              min={0}
              max={365}
              value={form.graceDays}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, graceDays: Math.max(0, Number(e.target.value) || 0) } : f,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minOutstanding">Minimum outstanding (MYR)</Label>
            <Input
              id="minOutstanding"
              type="number"
              min={0}
              step="0.01"
              value={form.minOutstanding}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? { ...f, minOutstanding: Math.max(0, Number(e.target.value) || 0) }
                    : f,
                )
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">In-app soft blocks</p>
          {(
            [
              ['softBlockFacility', 'Facility booking'],
              ['softBlockVisitors', 'Visitor invites'],
              ['softBlockDeliveryPasses', 'Delivery / e-hailing passes'],
              ['softBlockRecurringPasses', 'Recurring passes'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <Switch
                checked={form[key]}
                onCheckedChange={(v) => setForm((f) => (f ? { ...f, [key]: v } : f))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Export zones (hardware)</p>
          <p className="text-xs text-muted-foreground">
            Sent to integrators. Home / unit-door blocking is never included.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_ZONES.map((zone) => {
              const on = form.zones.includes(zone);
              return (
                <Button
                  key={zone}
                  type="button"
                  size="sm"
                  variant={on ? 'primary' : 'secondary'}
                  onClick={() => toggleZone(zone)}
                >
                  {ACCESS_RESTRICTION_ZONE_LABELS[zone]}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Integrator webhook</p>
              <p className="text-sm text-muted-foreground">
                POST signed JSON when a unit is restricted or cleared.
              </p>
            </div>
            <Switch
              checked={form.autoSyncEnabled}
              onCheckedChange={(autoSyncEnabled) =>
                setForm((f) => (f ? { ...f, autoSyncEnabled } : f))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://integrator.example/hooks/sr-access"
              value={form.webhookUrl}
              onChange={(e) => setForm((f) => (f ? { ...f, webhookUrl: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhookSecret">
              Webhook secret
              {settingsQ.data?.hasWebhookSecret ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (stored — leave blank to keep)
                </span>
              ) : null}
            </Label>
            <Input
              id="webhookSecret"
              type="password"
              autoComplete="new-password"
              placeholder="HMAC secret"
              value={form.webhookSecret}
              onChange={(e) => setForm((f) => (f ? { ...f, webhookSecret: e.target.value } : f))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={!dirty || update.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={recompute.isPending}
            onClick={async () => {
              try {
                const r = await recompute.mutateAsync(condoId);
                toast.success(
                  `Recomputed — activated ${r.activated}, cleared ${r.cleared}, skipped ${r.skipped}`,
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Recompute failed');
              }
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Recompute now
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Restricted units</h2>
            <p className="text-sm text-muted-foreground">
              {unitsQ.data
                ? `${unitsQ.data.items.filter((i) => i.active).length} active · ${unitsQ.data.eligibleArrearsCount} eligible by arrears`
                : '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  const payload = await api.exportAccessRestrictionsJson(condoId);
                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                    type: 'application/json',
                  });
                  await downloadBlob(blob, `access-restrictions-${condoId.slice(0, 8)}.json`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Export failed');
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  const blob = await api.downloadAccessRestrictionsCsv(condoId);
                  await downloadBlob(blob, `access-restrictions-${condoId.slice(0, 8)}.csv`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Export failed');
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-end">
          <UnitSearchPicker
            condoId={condoId}
            value={manualUnit}
            onChange={setManualUnit}
            label="Unit to restrict"
            placeholder="Search block or unit number…"
          />
          <div className="space-y-1.5">
            <Label htmlFor="manualReason">Reason (optional)</Label>
            <Input
              id="manualReason"
              placeholder="e.g. Manual hold pending dispute"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="lg:mb-0.5"
            disabled={!manualUnit || restrict.isPending}
            onClick={async () => {
              if (!manualUnit) return;
              try {
                await restrict.mutateAsync({
                  condoId,
                  unitId: manualUnit.id,
                  reason: manualReason.trim() || undefined,
                });
                toast.success('Unit restricted');
                setManualUnit(null);
                setManualReason('');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Restrict failed');
              }
            }}
          >
            Restrict
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['active', 'Active'],
                ['cleared', 'Cleared / exempt'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={opsFilter === id ? 'primary' : 'secondary'}
                onClick={() => setOpsFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Input
            className="sm:max-w-xs"
            placeholder="Filter by unit, reason, zone…"
            value={opsSearch}
            onChange={(e) => setOpsSearch(e.target.value)}
          />
        </div>

        {unitsQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !unitsQ.data?.items.length ? (
          <EmptyState
            title="No restriction rows yet"
            description="Enable the policy and recompute, or restrict a unit manually."
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No matching units"
            description="Try a different filter or search term."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-[rgb(var(--sr-border))]/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Outstanding</th>
                  <th className="px-3 py-2 font-medium">Oldest due</th>
                  <th className="px-3 py-2 font-medium">Activated</th>
                  <th className="px-3 py-2 font-medium">Zones</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">
                        {row.blockName ? `${row.blockName} · ` : ''}
                        {row.unitIdentifier}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.source}</div>
                    </td>
                    <td className="px-3 py-3">
                      {row.active ? (
                        <Badge tone="danger">Active</Badge>
                      ) : row.manualExempt ? (
                        <Badge tone="warning">Exempt</Badge>
                      ) : (
                        <Badge tone="neutral">Cleared</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatMoney(row.outstandingAmount)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.oldestDueDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.activatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.zones.length
                          ? row.zones.map((z) => (
                              <Badge key={z} tone="neutral">
                                {ACCESS_RESTRICTION_ZONE_LABELS[z]}
                              </Badge>
                            ))
                          : '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[14rem] text-muted-foreground">
                      {row.reason ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!row.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={restrict.isPending}
                          onClick={async () => {
                            try {
                              await restrict.mutateAsync({ condoId, unitId: row.unitId });
                              toast.success('Unit restricted');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed');
                            }
                          }}
                        >
                          Restrict
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={clear.isPending}
                          onClick={async () => {
                            try {
                              await clear.mutateAsync({ condoId, unitId: row.unitId });
                              toast.success('Unit cleared / exempted');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed');
                            }
                          }}
                        >
                          <ShieldOff className="mr-1 h-3.5 w-3.5" />
                          Clear
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
