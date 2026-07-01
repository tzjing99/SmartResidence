'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  useCompleteSetup,
  useDismissSetup,
  useMyCondos,
  useSetupStatus,
  useUpdateSetupStep,
} from '@smartresidence/api-client';
import {
  SETUP_STEP_META,
  SETUP_STEP_ORDER,
  type SetupStatus,
  type SetupStepKey,
  type SetupStepStatus,
  setupProgress,
} from '@smartresidence/shared-types';
import { Badge, Button, Card, Skeleton } from '@smartresidence/ui-web';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  CircleDashed,
  ExternalLink,
  PartyPopper,
  Rocket,
  SkipForward,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

type StepDisplay = 'done' | 'skipped' | 'attention' | 'todo';

function stepDisplay(step: SetupStepStatus): StepDisplay {
  if (step.satisfied === true || step.done) return 'done';
  if (step.skipped) return 'skipped';
  if (step.satisfied === false) return 'attention';
  return 'todo';
}

const DISPLAY_BADGE: Record<
  StepDisplay,
  { tone: 'success' | 'neutral' | 'warning' | 'info'; label: string }
> = {
  done: { tone: 'success', label: 'Done' },
  skipped: { tone: 'neutral', label: 'Skipped' },
  attention: { tone: 'warning', label: 'Needs attention' },
  todo: { tone: 'info', label: 'To do' },
};

function StepIcon({ display }: { display: StepDisplay }) {
  if (display === 'done') return <CheckCircle2 className="size-5 text-emerald-500" />;
  if (display === 'skipped') return <SkipForward className="size-5 sr-muted" />;
  if (display === 'attention') return <CircleDashed className="size-5 text-amber-500" />;
  return <Circle className="size-5 sr-muted" />;
}

function factLine(key: SetupStepKey, status: SetupStatus): string[] {
  const f = status.facts;
  switch (key) {
    case 'condoProfile':
      return [
        f.hasProfile
          ? 'Building name and address are set'
          : 'Add your building name and address in Settings',
      ];
    case 'structure':
      return [
        `${f.blockCount} block${f.blockCount === 1 ? '' : 's'}`,
        `${f.unitTypeCount} unit type${f.unitTypeCount === 1 ? '' : 's'}`,
        `${f.unitCount} unit${f.unitCount === 1 ? '' : 's'}`,
      ];
    case 'billing':
      return [
        `${f.feeRateCount} fee rate${f.feeRateCount === 1 ? '' : 's'} configured`,
        f.hasReceiptTemplate ? 'Receipt details filled in' : 'Receipt details still needed',
        f.billingAutomationEnabled
          ? 'Monthly invoice automation is on'
          : 'Monthly invoice automation is off (optional)',
        f.enabledGatewayCount > 0
          ? `${f.enabledGatewayCount} online payment method${f.enabledGatewayCount === 1 ? '' : 's'} enabled`
          : 'No online payment method yet (cash or manual is fine)',
      ];
    case 'residents':
      return [`${f.residentCount} resident${f.residentCount === 1 ? '' : 's'} onboarded`];
    case 'operations':
      return [
        f.slaPolicyCount > 0
          ? `${f.slaPolicyCount} helpdesk SLA rule${f.slaPolicyCount === 1 ? '' : 's'} configured`
          : 'Using default helpdesk SLA settings',
      ];
    case 'integrations':
      return [
        f.mcpCount > 0
          ? `${f.mcpCount} integration${f.mcpCount === 1 ? '' : 's'} connected`
          : 'No integrations connected yet (optional)',
      ];
    default:
      return [];
  }
}

export default function AdminSetupPage() {
  const router = useRouter();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const status = useSetupStatus(api, condo?.id ?? null);
  const updateStep = useUpdateSetupStep(api);
  const completeSetup = useCompleteSetup(api);
  const dismissSetup = useDismissSetup(api);

  const [activeKey, setActiveKey] = React.useState<SetupStepKey | null>(null);

  const steps = status.data?.steps ?? [];
  const stepByKey = React.useMemo(() => {
    const map = new Map<SetupStepKey, SetupStepStatus>();
    for (const s of steps) map.set(s.key, s);
    return map;
  }, [steps]);

  // Resume: default to the first step that still needs attention.
  React.useEffect(() => {
    if (activeKey || steps.length === 0) return;
    const firstOpen = SETUP_STEP_ORDER.find((key) => {
      const s = stepByKey.get(key);
      return s && key !== 'review' && stepDisplay(s) !== 'done' && stepDisplay(s) !== 'skipped';
    });
    setActiveKey(firstOpen ?? 'review');
  }, [activeKey, steps.length, stepByKey]);

  if (condos.isLoading || status.isLoading || !status.data) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const data = status.data;
  const progress = setupProgress(data);
  const activeStep = activeKey ? stepByKey.get(activeKey) : undefined;
  const activeMeta = activeKey ? SETUP_STEP_META[activeKey] : undefined;
  const condoId = condo?.id;

  const goNext = () => {
    if (!activeKey) return;
    const idx = SETUP_STEP_ORDER.indexOf(activeKey);
    const next = SETUP_STEP_ORDER[idx + 1];
    setActiveKey(next ?? 'review');
  };

  const markStep = (done: boolean) => {
    if (!condoId || !activeKey) return;
    updateStep.mutate(
      { condoId, input: { step: activeKey, done, skipped: false } },
      {
        onSuccess: () => {
          toast.success(done ? 'Step marked as done' : 'Step reopened');
          if (done) goNext();
        },
        onError: () => toast.error('Could not update this step'),
      },
    );
  };

  const skipStep = () => {
    if (!condoId || !activeKey) return;
    updateStep.mutate(
      { condoId, input: { step: activeKey, skipped: true, done: false } },
      {
        onSuccess: () => {
          toast.message('Step skipped — you can finish it later from Settings');
          goNext();
        },
        onError: () => toast.error('Could not skip this step'),
      },
    );
  };

  const finish = () => {
    if (!condoId) return;
    completeSetup.mutate(
      { condoId },
      {
        onSuccess: () => {
          toast.success('Your building is set up. Welcome aboard!');
          router.push('/admin');
        },
        onError: () => toast.error('Could not finish setup'),
      },
    );
  };

  const deferSetup = () => {
    if (!condoId) return;
    dismissSetup.mutate(
      { condoId },
      {
        onSuccess: () => {
          toast.message('You can finish setup any time from Settings or the dashboard banner.');
          router.push('/admin');
        },
        onError: () => toast.error('Could not defer setup'),
      },
    );
  };

  if (data.completedAt) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <Card className="flex flex-col items-center gap-4 text-center py-12">
          <span className="grid size-14 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
            <PartyPopper className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Setup complete</h1>
            <p className="sr-muted mt-1">
              {condo?.name ?? 'Your building'} was marked as configured on{' '}
              {new Date(data.completedAt).toLocaleDateString()}.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin">Go to dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isFreshInstance =
    data.facts.blockCount === 0 && data.facts.unitCount === 0 && data.facts.residentCount === 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="size-6 text-coral-500" />
          <h1 className="text-2xl font-bold tracking-tight">
            Set up {condo?.name ?? 'your building'}
          </h1>
        </div>
        <p className="sr-muted">
          Work through the steps below in order. You can leave and come back — your progress is
          saved, and you can change anything later from Settings.
        </p>
        {isFreshInstance ? (
          <Card className="border-coral-500/30 bg-coral-500/5 mt-1">
            <p className="text-sm">
              This looks like a brand-new building. Start with <strong>Building details</strong>,
              then add your blocks and units — that unlocks billing and resident invites.
            </p>
          </Card>
        ) : null}
        <div className="flex items-center gap-3 mt-1">
          <div className="h-2 flex-1 max-w-xs rounded-full bg-[rgb(var(--sr-border))]/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-coral-500 transition-[width] duration-300"
              style={{
                width: `${progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="text-sm sr-muted">
            {progress.completed} of {progress.total} essentials ready
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_1fr] gap-6">
        <nav aria-label="Setup steps" className="flex flex-col gap-1.5">
          {SETUP_STEP_ORDER.map((key, idx) => {
            const step = stepByKey.get(key);
            if (!step) return null;
            const meta = SETUP_STEP_META[key];
            const display = stepDisplay(step);
            const active = key === activeKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveKey(key)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-coral-500/40 bg-coral-500/5'
                    : 'border-[rgb(var(--sr-border))]/70 hover:bg-[rgb(var(--sr-bg))]/70'
                }`}
              >
                <StepIcon display={key === 'review' ? (data.ready ? 'done' : 'todo') : display} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {idx + 1}. {meta.title}
                  </span>
                  {key !== 'review' ? (
                    <span className="block text-xs sr-muted mt-0.5">
                      {DISPLAY_BADGE[display].label}
                    </span>
                  ) : (
                    <span className="block text-xs sr-muted mt-0.5">
                      {data.ready ? 'Ready to finish' : 'Complete the essentials first'}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activeStep && activeMeta && activeKey !== 'review' ? (
            <Card className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{activeMeta.title}</h2>
                  <p className="sr-muted mt-1">{activeMeta.description}</p>
                </div>
                <Badge tone={DISPLAY_BADGE[stepDisplay(activeStep)].tone}>
                  {DISPLAY_BADGE[stepDisplay(activeStep)].label}
                </Badge>
              </div>

              {factLine(activeStep.key, data).length > 0 ? (
                <ul className="flex flex-col gap-2 rounded-xl border border-[rgb(var(--sr-border))]/70 p-4">
                  {factLine(activeStep.key, data).map((line) => (
                    <li key={line} className="flex items-center gap-2 text-sm">
                      <Building2 className="size-4 sr-muted" />
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm sr-muted rounded-xl border border-[rgb(var(--sr-border))]/70 p-4">
                  Review the linked settings, then mark this step done or skip it for now.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="secondary">
                  <Link href={activeMeta.href}>
                    Open settings <ExternalLink className="size-4" />
                  </Link>
                </Button>
                {activeStep.key === 'billing' ? (
                  <Button asChild variant="ghost">
                    <Link href="/admin/automations">Invoice automation</Link>
                  </Button>
                ) : null}
                {activeStep.done ? (
                  <Button
                    variant="ghost"
                    onClick={() => markStep(false)}
                    disabled={updateStep.isPending}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="soft-success"
                    onClick={() => markStep(true)}
                    disabled={updateStep.isPending}
                  >
                    <CheckCircle2 className="size-4" /> Mark done & continue
                  </Button>
                )}
                {activeMeta.skippable && !activeStep.skipped ? (
                  <Button variant="ghost" onClick={skipStep} disabled={updateStep.isPending}>
                    <SkipForward className="size-4" /> Skip for now
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={goNext} className="ml-auto">
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </Card>
          ) : null}

          {activeKey === 'review' ? (
            <Card className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold">Review and finish</h2>
                <p className="sr-muted mt-1">
                  Here is where each step stands. Finish when you are happy — you can always change
                  things later from Settings.
                </p>
              </div>
              <ul className="flex flex-col divide-y divide-[rgb(var(--sr-border))]/60">
                {SETUP_STEP_ORDER.filter((k) => k !== 'review').map((key) => {
                  const step = stepByKey.get(key);
                  if (!step) return null;
                  const meta = SETUP_STEP_META[key];
                  const display = stepDisplay(step);
                  return (
                    <li key={key} className="flex items-center gap-3 py-3">
                      <StepIcon display={display} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium">{meta.title}</span>
                      </span>
                      <Badge tone={DISPLAY_BADGE[display].tone}>
                        {DISPLAY_BADGE[display].label}
                      </Badge>
                      <Button asChild variant="ghost" size="sm" onClick={() => setActiveKey(key)}>
                        <span>Edit</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {!data.ready ? (
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3">
                  Some steps still need attention. You can finish anyway, but we recommend fixing or
                  skipping them first.
                </p>
              ) : null}
              <div className="flex items-center gap-3">
                <Button onClick={finish} disabled={completeSetup.isPending} size="lg">
                  <PartyPopper className="size-4" /> Finish setup
                </Button>
                <Button
                  variant="ghost"
                  onClick={deferSetup}
                  disabled={dismissSetup.isPending}
                >
                  Do this later
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
