'use client';

import { api } from '@/lib/api';
import { type AbilityRule, hasAbility } from '@/lib/roles';
import { useMe, useMyCondos, useSlaAudit } from '@smartresidence/api-client';
import { Card, Skeleton } from '@smartresidence/ui-web';
import { History, Shield } from 'lucide-react';

/** G1: read-only SLA settings audit log for unit owners. */
export default function SlaAuditPage() {
  const me = useMe(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const audit = useSlaAudit(api, condo?.id ?? null);

  const abilities = ((me.data as { abilities?: AbilityRule[] } | undefined)?.abilities ??
    []) as AbilityRule[];
  const canRead = hasAbility(abilities, 'read', 'SlaPolicy');

  if (!canRead) {
    return (
      <div className="sr-muted text-sm">
        You do not have access to the SLA audit log for this condo.
      </div>
    );
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h2 className="sr-section-title flex items-center gap-2">
          <Shield className="size-5" /> Response time history
        </h2>
        <p className="sr-muted text-sm mt-1">
          Read-only history of helpdesk SLA policy changes for {condo?.name ?? 'your condo'}.
          Management admins configure these values; owners can review changes here for transparency.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <History className="size-4" /> Change log
        </h3>
        {audit.isLoading ? (
          <Skeleton className="h-24" />
        ) : audit.data?.items?.length ? (
          <ul className="flex flex-col gap-3 text-sm">
            {(
              audit.data.items as Array<{
                id: string;
                createdAt: string;
                actor?: { name: string };
                metadata?: {
                  before?: unknown;
                  after?: unknown;
                  riskyAcknowledged?: boolean;
                  rationale?: string | null;
                };
              }>
            ).map((row) => (
              <li
                key={row.id}
                className="border-b border-[rgb(var(--sr-border))]/40 pb-3 last:border-0"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{row.actor?.name ?? 'System'}</span>
                  <span className="sr-muted text-xs shrink-0">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
                {row.metadata?.riskyAcknowledged ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Risky-band save — announcement published
                  </p>
                ) : null}
                {row.metadata?.rationale ? (
                  <p className="text-xs sr-muted mt-1">Rationale: {row.metadata.rationale}</p>
                ) : null}
                <p className="text-xs sr-muted mt-1 font-mono">Ref: {row.id.slice(0, 8)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm sr-muted">No SLA policy changes recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
