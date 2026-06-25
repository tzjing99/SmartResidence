'use client';

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useMyCondos, useSetUnitType, useUnitTypes } from '@smartresidence/api-client';
import { Card, EmptyState, Input, Select, Skeleton } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

const NO_TYPE = '__none__';

export default function AdminUnitsPage() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const [search, setSearch] = useState('');
  const unitTypes = useUnitTypes(api, condo?.id ?? null);
  const setUnitType = useSetUnitType(api);

  const units = useQuery({
    queryKey: ['admin', 'units', condo?.id, search],
    queryFn: () =>
      condo
        ? api.listUnits(condo.id, { search: search || undefined, limit: 100 })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condo),
  });

  const typeOptions = [
    { value: NO_TYPE, label: 'No type' },
    ...(unitTypes.data ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];

  async function assignType(unitId: string, value: string) {
    if (!condo) return;
    try {
      await setUnitType.mutateAsync({
        condoId: condo.id,
        unitId,
        unitTypeId: value === NO_TYPE ? null : value,
      });
      toast.success('Unit type updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Residents & units</h1>
          <p className="sr-muted">{units.data?.total ?? 0} units</p>
        </div>
        <div className="flex items-center gap-3">
          {(unitTypes.data?.length ?? 0) === 0 ? (
            <Link
              href="/admin/settings/unit-types"
              className="text-sm font-medium text-[rgb(var(--sr-coral))] hover:underline"
            >
              Set up unit types →
            </Link>
          ) : null}
          <div className="w-72">
            <Input
              placeholder="Search by unit number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {units.isLoading ? (
        <Skeleton className="h-96" />
      ) : (units.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No units" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase sr-muted bg-[rgb(var(--sr-bg))]">
              <tr>
                <th className="py-3 px-4">Unit</th>
                <th>Block</th>
                <th>Sqft</th>
                <th>Owner</th>
                <th>Status</th>
                <th className="pr-4">Unit type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--sr-border))]">
              {(units.data?.items as any[]).map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium">{u.identifier}</td>
                  <td>{u.block?.name ?? '—'}</td>
                  <td className="sr-muted">{u.sqft ?? '—'}</td>
                  <td>
                    {u.ownerships?.[0]?.user?.name ?? <span className="sr-muted">unassigned</span>}
                  </td>
                  <td className="sr-muted">{u.status.toLowerCase().replace('_', ' ')}</td>
                  <td className="pr-4 py-2">
                    <Select
                      value={u.unitTypeId ?? NO_TYPE}
                      onValueChange={(v) => assignType(u.id, v)}
                      options={typeOptions}
                      aria-label={`Unit type for ${u.identifier}`}
                      className="w-44"
                    />
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
