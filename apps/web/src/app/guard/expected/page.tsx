'use client';

import { WalkInContactPanel } from '@/components/walk-in-contact-panel';
import { api } from '@/lib/api';
import { queryKeys, useMyCondos } from '@smartresidence/api-client';
import {
  formatMalaysiaPhoneDisplay,
  malaysiaPhoneTelHref,
  type Visitor,
} from '@smartresidence/shared-types';
import { Badge, Card, EmptyState, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';

export default function GuardExpectedPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const visitors = useQuery({
    queryKey: condo ? queryKeys.condoVisitors(condo.id) : ['visitors', 'condo', null],
    queryFn: () =>
      condo ? api.visitorsForCondo(condo.id) : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
    refetchInterval: 30_000,
  });

  const items = (visitors.data?.items ?? []) as Array<
    Visitor & { unit?: { identifier?: string } }
  >;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Expected visitors</h1>
        <p className="sr-muted mt-1">
          Upcoming and pending visitors across the condo. Use{' '}
          <a href="/guard/check-in" className="text-coral-500 hover:underline">
            check-in
          </a>{' '}
          or the mobile guard app to verify passes.
        </p>
      </header>

      {visitors.isLoading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState title="No visitors expected" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted">
              <tr>
                <th className="py-2">Visitor</th>
                <th>Unit</th>
                <th>Expected</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {items.map((v) => (
                <tr key={v.id}>
                  <td className="py-3 font-medium">
                    {v.name}
                    {v.vehiclePlate ? (
                      <span className="sr-muted font-normal"> · {v.vehiclePlate}</span>
                    ) : null}
                  </td>
                  <td>{v.unit?.identifier ?? '—'}</td>
                  <td className="sr-muted">{new Date(v.expectedAt).toLocaleString()}</td>
                  <td>
                    <Badge
                      tone={
                        v.status === 'CHECKED_IN'
                          ? 'success'
                          : v.status === 'CANCELLED' || v.status === 'REJECTED'
                            ? 'danger'
                            : v.status === 'PENDING_OWNER_APPROVAL'
                              ? 'warning'
                              : 'primary'
                      }
                    >
                      {v.status.toLowerCase().replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 text-right align-top">
                    {v.status === 'PENDING_OWNER_APPROVAL' ? (
                      <WalkInContactPanel
                        visitorPhone={v.phone}
                        visitorPhoneCountryCode={v.phoneCountryCode}
                        ownerContacts={v.ownerContacts}
                        compact
                      />
                    ) : (() => {
                      const display = formatMalaysiaPhoneDisplay(v.phone, v.phoneCountryCode);
                      const href = malaysiaPhoneTelHref(v.phone, v.phoneCountryCode);
                      return display && href ? (
                        <a href={href} className="text-sm text-coral-600 hover:underline">
                          {display}
                        </a>
                      ) : null;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
