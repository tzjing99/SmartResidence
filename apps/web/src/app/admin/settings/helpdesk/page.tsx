'use client';

import { useT } from '@/i18n/locale-provider';
import { api } from '@/lib/api';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { CATEGORIES, prettyLabel } from '@/lib/thread-ui';
import { toast } from '@/lib/toast';
import {
  useMe,
  useMyCondos,
  useSlaAudit,
  useSlaSettings,
  useUpdateAutoAssignment,
  useUpdateMlAssignment,
  useUpdateMlPriority,
  useUpdateSlaSettings,
} from '@smartresidence/api-client';
import type {
  SlaBand,
  SlaPolicyItem,
  ThreadCategory,
  ThreadPriority,
} from '@smartresidence/api-client';
import { Badge, Button, Card, Input, Skeleton, Textarea } from '@smartresidence/ui-web';
import { AlertTriangle, History, Save, Settings2, Sparkles, Users } from 'lucide-react';
import * as React from 'react';

const PRIORITIES: ThreadPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
const POOL_CATEGORIES: ThreadCategory[] = CATEGORIES.map((c) => c.value as ThreadCategory);
const BAND_TONE: Record<SlaBand, 'success' | 'warning' | 'danger'> = {
  recommended: 'success',
  acceptable: 'warning',
  risky: 'danger',
};

function formatMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) return `${(mins / 60).toFixed(1)} h`;
  return `${(mins / (24 * 60)).toFixed(1)} d`;
}

function bandForMins(item: SlaPolicyItem, mins: number): SlaBand {
  if (mins <= item.thresholds.recommendedMaxMins) return 'recommended';
  if (mins <= item.thresholds.acceptableMaxMins) return 'acceptable';
  return 'risky';
}

function PrioritySlider({
  item,
  value,
  onChange,
  disabled,
}: {
  item: SlaPolicyItem;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const tr = useT();
  const max = Math.max(item.thresholds.acceptableMaxMins * 1.5, item.recommendedResolutionMins * 3);
  const band = bandForMins(item, value);
  const recPct = (item.thresholds.recommendedMaxMins / max) * 100;
  const accPct = (item.thresholds.acceptableMaxMins / max) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{prettyLabel(tr, item.priority)}</span>
        <Badge tone={BAND_TONE[band]}>{prettyLabel(tr, band)}</Badge>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-[rgb(var(--sr-border))]/40">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-400/50"
          style={{ width: `${recPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400/50"
          style={{ left: `${recPct}%`, width: `${accPct - recPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-red-400/50"
          style={{ left: `${accPct}%`, right: 0 }}
        />
      </div>
      <input
        type="range"
        min={15}
        max={max}
        step={15}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--sr-coral))]"
      />
      <div className="flex justify-between text-xs sr-muted">
        <span>Resolution: {formatMins(value)}</span>
        <span>First response: {formatMins(Math.round(value * 0.4))} (40%)</span>
      </div>
    </div>
  );
}

export default function HelpdeskSettingsPage() {
  const tr = useT();
  const me = useMe(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const settings = useSlaSettings(api, condo?.id ?? null);
  const audit = useSlaAudit(api, condo?.id ?? null);
  const save = useUpdateSlaSettings(api);
  const savePools = useUpdateAutoAssignment(api);
  const saveMlPriority = useUpdateMlPriority(api);
  const saveMlAssignment = useUpdateMlAssignment(api);

  const abilities = ((me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];
  const canEdit = hasAbility(abilities, 'update', 'SlaPolicy');

  const [resolutionMins, setResolutionMins] = React.useState<Record<ThreadPriority, number>>({
    URGENT: 240,
    HIGH: 1440,
    NORMAL: 4320,
    LOW: 10080,
  });
  const [graceDays, setGraceDays] = React.useState(7);
  const [showRiskyModal, setShowRiskyModal] = React.useState(false);
  const [rationale, setRationale] = React.useState('');
  const [generalPool, setGeneralPool] = React.useState<string[]>([]);
  const [seniorPool, setSeniorPool] = React.useState<string[]>([]);
  const [categoryPools, setCategoryPools] = React.useState<Record<ThreadCategory, string[]>>({
    BILLING: [],
    MAINTENANCE: [],
    FACILITY: [],
    SECURITY: [],
    COMPLAINT: [],
    SUGGESTION: [],
    GOVERNANCE: [],
    GENERAL: [],
  });

  React.useEffect(() => {
    if (!settings.data) return;
    const map: Record<ThreadPriority, number> = {
      URGENT: 240,
      HIGH: 1440,
      NORMAL: 4320,
      LOW: 10080,
    };
    for (const p of settings.data.policies) {
      map[p.priority] = p.resolutionMins;
    }
    setResolutionMins(map);
    setGraceDays(settings.data.resolutionConfirmationGraceDays);
    const aa = settings.data.autoAssignment;
    if (aa) {
      setGeneralPool(aa.generalTriagePool ?? []);
      setSeniorPool(aa.seniorStaffPool ?? []);
      const catMap: Record<ThreadCategory, string[]> = {
        BILLING: [],
        MAINTENANCE: [],
        FACILITY: [],
        SECURITY: [],
        COMPLAINT: [],
        SUGGESTION: [],
        GOVERNANCE: [],
        GENERAL: [],
      };
      for (const p of aa.categoryPools ?? []) {
        catMap[p.category] = p.userIds ?? [];
      }
      setCategoryPools(catMap);
    }
  }, [settings.data]);

  const staff = settings.data?.managementStaff ?? [];

  function togglePoolUser(pool: string[], setPool: (v: string[]) => void, userId: string) {
    setPool(pool.includes(userId) ? pool.filter((id) => id !== userId) : [...pool, userId]);
  }

  async function savePoolSettings() {
    if (!condo?.id) return;
    try {
      await savePools.mutateAsync({
        condoId: condo.id,
        generalTriagePool: generalPool,
        seniorStaffPool: seniorPool,
        categoryPools: POOL_CATEGORIES.map((category) => ({
          category,
          userIds: categoryPools[category] ?? [],
        })).filter((p) => p.userIds.length > 0),
      });
      toast.success('Assignee pools saved');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function PoolPicker({
    label,
    pool,
    setPool,
  }: {
    label: string;
    pool: string[];
    setPool: (v: string[]) => void;
  }) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-1.5 text-sm rounded-lg border border-[rgb(var(--sr-border))] px-2 py-1 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={pool.includes(s.id)}
                disabled={!canEdit}
                onChange={() => togglePoolUser(pool, setPool, s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>
    );
  }

  const policies = settings.data?.policies ?? [];
  const mlPriority = settings.data?.mlPriority;
  const mlAssignment = settings.data?.mlAssignment;
  const hasRisky = policies.some((p) => bandForMins(p, resolutionMins[p.priority]) === 'risky');

  async function toggleMlPriority(enabled: boolean) {
    if (!condo?.id) return;
    try {
      await saveMlPriority.mutateAsync({ condoId: condo.id, enabled });
      toast.success(enabled ? 'Smart priority enabled' : 'Smart priority disabled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleMlAssignment(enabled: boolean) {
    if (!condo?.id) return;
    try {
      await saveMlAssignment.mutateAsync({ condoId: condo.id, enabled });
      toast.success(enabled ? 'Smart assignment enabled' : 'Smart assignment disabled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function doSave(riskyAcknowledged = false) {
    if (!condo?.id) return;
    try {
      await save.mutateAsync({
        condoId: condo.id,
        policies: PRIORITIES.map((priority) => ({
          priority,
          resolutionMins: resolutionMins[priority],
        })),
        resolutionConfirmationGraceDays: graceDays,
        riskyAcknowledged: riskyAcknowledged || undefined,
        rationale: rationale.trim() || undefined,
      });
      toast.success(
        riskyAcknowledged
          ? 'SLA saved — transparency announcement published'
          : 'SLA settings saved',
      );
      setShowRiskyModal(false);
      setRationale('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleSave() {
    if (hasRisky) {
      setShowRiskyModal(true);
      return;
    }
    void doSave();
  }

  if (settings.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="sr-section-title flex items-center gap-2">
          <Settings2 className="size-5" /> Helpdesk & SLA
        </h2>
        <p className="sr-muted text-sm mt-1">
          Set how quickly management should reply and resolve helpdesk messages for each priority
          level. First-reply targets are set to 40% of the resolution time.
        </p>
        {settings.data ? (
          <p className="text-xs sr-muted mt-1">
            {settings.data.unitCount} units · advisory bands scale with condo size
          </p>
        ) : null}
      </div>

      <Card className="p-5 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="grace-days">
            Resolution confirmation grace period (days)
          </label>
          <Input
            id="grace-days"
            type="number"
            min={1}
            max={30}
            value={graceDays}
            disabled={!canEdit}
            onChange={(e) => setGraceDays(Number(e.target.value))}
            className="h-10 w-32"
          />
          <p className="text-xs sr-muted">
            Days a resident has to confirm a proposed resolution before auto-confirm (default 7).
          </p>
        </div>

        {policies.map((item) => (
          <PrioritySlider
            key={item.priority}
            item={item}
            value={resolutionMins[item.priority]}
            onChange={(v) => setResolutionMins((prev) => ({ ...prev, [item.priority]: v }))}
            disabled={!canEdit}
          />
        ))}

        {canEdit ? (
          <Button onClick={handleSave} disabled={save.isPending}>
            <Save className="size-4" />
            Save response-time settings
          </Button>
        ) : (
          <p className="text-sm sr-muted">Read-only — contact a management admin to edit.</p>
        )}
      </Card>

      <Card className="p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4" /> Smart priority
          </h2>
          <p className="text-xs sr-muted mt-1">
            Learns from your closed tickets to suggest priority on new threads. Emergency keywords
            (fire, gas, flood, etc.) always override. Falls back to rules when disabled or
            insufficient history.
          </p>
        </div>
        {mlPriority ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Closed tickets: {mlPriority.closedThreadCount} / {mlPriority.minRequired}
              </span>
              {mlPriority.active ? (
                <Badge tone="success">Active</Badge>
              ) : mlPriority.ready ? (
                <Badge tone="warning">Ready — off</Badge>
              ) : (
                <Badge tone="neutral">Collecting data</Badge>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={mlPriority.enabled}
                disabled={
                  !canEdit || saveMlPriority.isPending || (!mlPriority.ready && !mlPriority.enabled)
                }
                onChange={(e) => void toggleMlPriority(e.target.checked)}
              />
              Enable smart priority suggestions
            </label>
            {!mlPriority.ready ? (
              <p className="text-xs sr-muted">
                Need {mlPriority.minRequired - mlPriority.closedThreadCount} more closed tickets
                before smart priority can be turned on. Standard rules are used in the meantime.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm sr-muted">Priority stats unavailable.</p>
        )}
      </Card>

      <Card className="p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4" /> Smart assignment (beta)
          </h2>
          <p className="text-xs sr-muted mt-1">
            Learns from closed tickets to suggest who should handle new messages. Needs at least 200
            closed tickets. Falls back to category-based assignment when off or not enough history.
          </p>
        </div>
        {mlAssignment ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Closed tickets: {mlAssignment.closedThreadCount} / {mlAssignment.minRequired}
              </span>
              {mlAssignment.active ? (
                <Badge tone="success">Active</Badge>
              ) : mlAssignment.ready ? (
                <Badge tone="warning">Ready — off</Badge>
              ) : (
                <Badge tone="neutral">Collecting data</Badge>
              )}
              {mlAssignment.modelLoaded ? (
                <Badge tone="neutral">
                  Model
                  {mlAssignment.modelSampleCount != null
                    ? ` (${mlAssignment.modelSampleCount} samples)`
                    : ''}
                </Badge>
              ) : (
                <Badge tone="warning">No model artifact</Badge>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={mlAssignment.enabled}
                disabled={
                  !canEdit ||
                  saveMlAssignment.isPending ||
                  (!mlAssignment.ready && !mlAssignment.enabled)
                }
                onChange={(e) => void toggleMlAssignment(e.target.checked)}
              />
              Enable smart assignment suggestions
            </label>
            {mlAssignment.enabled && mlAssignment.ready && !mlAssignment.modelLoaded ? (
              <p className="text-xs sr-muted">
                Smart assignment is on, but no trained model artifact is loaded. Run{' '}
                <code className="text-[11px]">pnpm ml:train-assignment</code> in{' '}
                <code className="text-[11px]">apps/api</code> (or set{' '}
                <code className="text-[11px]">ML_ASSIGNMENT_MODEL_PATH</code>). Rules-based pools
                are used until a model is available.
              </p>
            ) : null}
            {!mlAssignment.ready ? (
              <p className="text-xs sr-muted">
                Need {mlAssignment.minRequired - mlAssignment.closedThreadCount} more closed tickets
                before smart assignment can be enabled. Rules-based pools are used in the meantime.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm sr-muted">Assignment stats unavailable.</p>
        )}
      </Card>

      <Card className="p-5 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="size-4" /> Staff assignment lists
          </h2>
          <p className="text-xs sr-muted mt-1">
            Choose which staff members can be auto-assigned to new helpdesk messages by category.
            General messages use the main team; repeat complainants can go to senior staff.
          </p>
        </div>
        {staff.length === 0 ? (
          <p className="text-sm sr-muted">No management staff found for this condo.</p>
        ) : (
          <>
            <PoolPicker label="General team" pool={generalPool} setPool={setGeneralPool} />
            <PoolPicker
              label="Senior staff (repeat complainants)"
              pool={seniorPool}
              setPool={setSeniorPool}
            />
            {POOL_CATEGORIES.filter((c) => c !== 'GENERAL').map((category) => (
              <PoolPicker
                key={category}
                label={prettyLabel(tr, category)}
                pool={categoryPools[category]}
                setPool={(ids) => setCategoryPools((prev) => ({ ...prev, [category]: ids }))}
              />
            ))}
            {canEdit ? (
              <Button onClick={savePoolSettings} disabled={savePools.isPending}>
                <Save className="size-4" />
                Save staff lists
              </Button>
            ) : null}
          </>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <History className="size-4" /> SLA change audit log
        </h2>
        {audit.isLoading ? (
          <Skeleton className="h-24" />
        ) : audit.data?.items?.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {(
              audit.data.items as Array<{ id: string; createdAt: string; actor?: { name: string } }>
            ).map((row) => (
              <li
                key={row.id}
                className="flex justify-between gap-2 border-b border-[rgb(var(--sr-border))]/40 pb-2"
              >
                <span>{row.actor?.name ?? 'System'}</span>
                <span className="sr-muted text-xs">{new Date(row.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm sr-muted">No SLA changes recorded yet.</p>
        )}
      </Card>

      {showRiskyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md w-full p-5 flex flex-col gap-4">
            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <div className="font-semibold">Risky SLA settings</div>
                <p className="text-sm sr-muted mt-1">
                  One or more priorities exceed feasible staffing norms. Saving will publish a
                  public announcement to all residents explaining the change.
                </p>
              </div>
            </div>
            <Textarea
              placeholder="Optional rationale for residents…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowRiskyModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => doSave(true)} disabled={save.isPending}>
                Proceed and publish
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
